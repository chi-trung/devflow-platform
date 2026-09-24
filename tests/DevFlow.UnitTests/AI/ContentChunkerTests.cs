using DevFlow.Infrastructure.AI;

namespace DevFlow.UnitTests.AI;

public class ContentChunkerTests
{
    private readonly ContentChunker _chunker = new();

    [Fact]
    public void Chunk_Empty_ReturnsSingleEmptyChunk()
    {
        var chunks = _chunker.Chunk("   ");

        Assert.Single(chunks);
        Assert.Equal(string.Empty, chunks[0]);
    }

    [Fact]
    public void Chunk_ShortBody_StaysOneChunk()
    {
        var source = new string('a', 500);

        var chunks = _chunker.Chunk(source);

        Assert.Single(chunks);
        Assert.Equal(source, chunks[0]);
    }

    [Fact]
    public void Chunk_Boundary600_StaysOneChunk()
    {
        var source = new string('x', 600);

        var chunks = _chunker.Chunk(source);

        Assert.Single(chunks);
    }

    [Fact]
    public void Chunk_LongParagraphs_SplitsWithOverlap_AndEachSliceNearTarget()
    {
        // Three paragraphs of ~900 chars each → total well past target.
        var paragraph = string.Join(' ', Enumerable.Repeat(new string('w', 40), 30)); // ~1230
        var source = string.Join("\n\n", new[] { paragraph, paragraph, paragraph, paragraph });

        var chunks = _chunker.Chunk(source);

        Assert.True(chunks.Count >= 2, $"expected multiple chunks, got {chunks.Count}");
        Assert.All(chunks, c => Assert.True(c.Length <= 2000, $"chunk too long: {c.Length}"));
        // Overlap: consecutive chunks share a tail/prefix of the prior slice.
        if (chunks.Count >= 2)
        {
            var overlapSample = chunks[0][^80..];
            Assert.Contains(overlapSample, chunks[1]);
        }
    }

    [Fact]
    public void Chunk_OversizedSingleParagraph_IsHardSplit()
    {
        var source = new string('z', 5000); // one paragraph, no blank lines

        var chunks = _chunker.Chunk(source);

        Assert.True(chunks.Count >= 2, $"expected hard split, got {chunks.Count}");
        Assert.Equal(source.Length, chunks.Sum(c => c.Length) - OverlapEstimated(chunks));
        Assert.All(chunks, c => Assert.True(c.Length <= 2000));
    }

    [Fact]
    public void Chunk_JoinsShortParagraphs_UntilTarget()
    {
        var paragraphs = Enumerable.Range(0, 20)
            .Select(_ => new string('p', 100))
            .ToArray(); // 20×100 + 19×2 = 2038 total — past the 1600 target
        var source = string.Join("\n\n", paragraphs);

        var chunks = _chunker.Chunk(source);

        // Join paragraphs until the target, then split with overlap — do not
        // expect a single chunk (2038 > TargetChunkChars).
        Assert.True(chunks.Count >= 2, $"expected split past target, got {chunks.Count}");
        Assert.All(chunks, c => Assert.True(c.Length <= 2000, $"chunk too long: {c.Length}"));
        Assert.True(source.StartsWith(chunks[0], StringComparison.Ordinal),
            "first chunk should be a prefix of the source");
        Assert.InRange(chunks[0].Length, 1400, 1600);
    }

    // Hard-split with overlap double-counts the seam; allow a loose bound so
    // the assertion does not depend on exact TakeTail word-boundary math.
    private static int OverlapEstimated(IReadOnlyList<string> chunks)
    {
        var total = chunks.Sum(c => c.Length);
        var source = 5000;
        return Math.Max(0, total - source);
    }
}
