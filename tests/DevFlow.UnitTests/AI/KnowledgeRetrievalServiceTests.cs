using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using DevFlow.Infrastructure.AI;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DevFlow.UnitTests.AI;

public class KnowledgeRetrievalServiceTests
{
    private readonly IKnowledgeRepository _knowledgeRepository = Substitute.For<IKnowledgeRepository>();
    private readonly IEmbeddingClient _embeddingClient = Substitute.For<IEmbeddingClient>();
    private readonly IReranker _reranker = Substitute.For<IReranker>();
    private readonly Guid _projectId = Guid.NewGuid();

    private KnowledgeRetrievalService CreateService(AiOptions? options = null) => new(
        _knowledgeRepository,
        _embeddingClient,
        _reranker,
        Options.Create(options ?? new AiOptions()),
        NullLogger<KnowledgeRetrievalService>.Instance);

    private static List<KnowledgeEntry> LiveEntries(Guid projectId)
    {
        var high = KnowledgeEntry.Create(projectId, "Deploy ADR", "Render + Vercel.", KnowledgeType.Adr);
        high.SetWeight(0.9m);
        var low = KnowledgeEntry.Create(projectId, "Old pattern", "Legacy.", KnowledgeType.Pattern);
        low.SetWeight(0.05m); // Superseded-style weight — must be excluded
        return [high, low];
    }

    [Fact]
    public async Task Retrieve_FallsBackToWeightOrder_WhenEmbeddingUnavailable()
    {
        _embeddingClient.EmbedAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((float[]?)null);
        _knowledgeRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(LiveEntries(_projectId));

        var hits = await CreateService().RetrieveAsync(_projectId, "how do we deploy", 12, 3500);

        Assert.Single(hits);
        Assert.Equal("Deploy ADR", hits[0].Title);
        Assert.Equal(0.9m, hits[0].Weight);
        Assert.Null(hits[0].Similarity);
    }

    [Fact]
    public async Task Retrieve_UsesVectorHits_WhenEmbeddingSucceeds()
    {
        _embeddingClient.EmbedAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new float[] { 1f, 0f, 0f });
        var vectorHit = new KnowledgeChunkHit(
            Guid.NewGuid(), 0, "Vector match", "chunk body",
            KnowledgeType.Pattern, KnowledgeStatus.Accepted, 0.7m, Similarity: 0.92);
        _knowledgeRepository.SearchChunksForProjectAsync(
                _projectId, Arg.Any<float[]>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new[] { vectorHit });

        var hits = await CreateService().RetrieveAsync(_projectId, "deploy", 12, 3500);

        Assert.Single(hits);
        Assert.Equal("Vector match", hits[0].Title);
        Assert.Equal(0.92, hits[0].Similarity);
    }

    [Fact]
    public async Task Retrieve_ClipsToBudget_ButKeepsAtLeastOneHit()
    {
        _embeddingClient.EmbedAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((float[]?)null);
        var entries = Enumerable.Range(0, 5)
            .Select(_ =>
            {
                var e = KnowledgeEntry.Create(_projectId, "Entry", new string('b', 2000), KnowledgeType.Runbook);
                e.SetWeight(0.8m);
                return e;
            })
            .ToList();
        _knowledgeRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(entries);

        // Tiny budget: only the first (header+body) may exceed it alone.
        var hits = await CreateService().RetrieveAsync(_projectId, "q", topK: 5, maxChars: 100);

        Assert.Single(hits);
    }

    [Fact]
    public async Task Retrieve_InvokesReranker_OnlyWhenEnabled()
    {
        var vectorHit = new KnowledgeChunkHit(
            Guid.NewGuid(), 0, "A", "body", KnowledgeType.Adr,
            KnowledgeStatus.Accepted, 1m, Similarity: 0.5);
        var reranked = new KnowledgeChunkHit(
            Guid.NewGuid(), 0, "B", "body", KnowledgeType.Adr,
            KnowledgeStatus.Accepted, 1m, Similarity: 0.3);

        _embeddingClient.EmbedAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new float[] { 1f });
        _knowledgeRepository.SearchChunksForProjectAsync(
                _projectId, Arg.Any<float[]>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new[] { vectorHit, reranked });
        _reranker.RerankAsync(Arg.Any<string>(), Arg.Any<IReadOnlyList<KnowledgeChunkHit>>(), Arg.Any<CancellationToken>())
            .Returns(new[] { reranked, vectorHit });

        // Default: rerank off
        var off = await CreateService().RetrieveAsync(_projectId, "q", 12, 3500);
        Assert.Equal("A", off[0].Title);
        await _reranker.DidNotReceive().RerankAsync(
            Arg.Any<string>(), Arg.Any<IReadOnlyList<KnowledgeChunkHit>>(), Arg.Any<CancellationToken>());

        // Enabled: order follows reranker
        var on = await CreateService(new AiOptions { EnableRerank = true })
            .RetrieveAsync(_projectId, "q", 12, 3500);
        Assert.Equal("B", on[0].Title);
        await _reranker.Received(1).RerankAsync(
            Arg.Any<string>(), Arg.Any<IReadOnlyList<KnowledgeChunkHit>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Retrieve_EmptyProject_ReturnsEmpty_NotThrow()
    {
        _embeddingClient.EmbedAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new float[] { 1f });
        _knowledgeRepository.SearchChunksForProjectAsync(
                _projectId, Arg.Any<float[]>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<KnowledgeChunkHit>());
        _knowledgeRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new List<KnowledgeEntry>());

        var hits = await CreateService().RetrieveAsync(_projectId, "anything", 12, 3500);

        Assert.NotNull(hits);
        Assert.Empty(hits);
    }
}
