namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Splits knowledge source text into retrieval-sized slices. Target is ~400
/// tokens (~1600 chars) with ~50 tokens of overlap; bodies under ~600 chars
/// stay a single chunk so short runbooks are never split.
/// </summary>
public interface IContentChunker
{
    /// <summary>
    /// Returns ordered chunks of <paramref name="source"/>. Always at least
    /// one element (the whole text when short / empty).
    /// </summary>
    IReadOnlyList<string> Chunk(string source);
}
