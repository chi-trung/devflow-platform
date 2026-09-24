using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Models;

/// <summary>
/// One retrieval hit handed to the prompt builder. <c>Content</c> is the
/// chunk text (or the whole body when the fallback path is used).
/// <c>Similarity</c> is null on the weight-ordered fallback (no vector).
/// </summary>
public sealed record KnowledgeChunkHit(
    Guid EntryId,
    int ChunkIndex,
    string Title,
    string Content,
    KnowledgeType Type,
    KnowledgeStatus Status,
    decimal Weight,
    double? Similarity);
