using System.Text;
using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// Paragraph-aware character chunker. ~400 tokens ≈ 1600 chars target,
/// ~50 tokens ≈ 200 chars overlap. Bodies under 600 chars stay one chunk so
/// short runbooks/ADRs are never split mid-sentence. Splits prefer blank-line
/// paragraph boundaries; an oversized paragraph falls back to a hard cut.
/// </summary>
public sealed class ContentChunker : IContentChunker
{
    private const int ShortBodyChars = 600;
    private const int TargetChunkChars = 1600;
    private const int OverlapChars = 200;
    private const int HardMinChars = 200;

    public IReadOnlyList<string> Chunk(string source)
    {
        var text = source?.Trim() ?? string.Empty;
        if (text.Length == 0)
        {
            return [string.Empty];
        }

        if (text.Length <= ShortBodyChars)
        {
            return [text];
        }

        var paragraphs = SplitParagraphs(text);
        var chunks = new List<string>();
        var current = new StringBuilder();

        foreach (var paragraph in paragraphs)
        {
            // Oversized single paragraph — hard-split it rather than emit one
            // multi-thousand-char chunk that defeats the point of chunking.
            if (paragraph.Length > TargetChunkChars)
            {
                if (current.Length > 0)
                {
                    chunks.Add(current.ToString().TrimEnd());
                    current.Clear();
                }

                foreach (var slice in HardSplit(paragraph))
                {
                    chunks.Add(slice);
                }

                continue;
            }

            if (current.Length > 0 &&
                current.Length + paragraph.Length + 2 > TargetChunkChars)
            {
                chunks.Add(current.ToString().TrimEnd());
                // Overlap: start the next chunk with the tail of the previous.
                current.Clear();
                var tail = TakeTail(chunks[^1], OverlapChars);
                if (tail.Length > 0)
                {
                    current.Append(tail).Append("\n\n");
                }
            }

            if (current.Length == 0)
            {
                current.Append(paragraph);
            }
            else
            {
                current.Append("\n\n").Append(paragraph);
            }
        }

        if (current.Length > 0)
        {
            var last = current.ToString().TrimEnd();
            // Drop a trailing chunk that is only the overlap carry-over.
            if (chunks.Count == 0 || last.Length >= HardMinChars ||
                !last.StartsWith(TakeTail(chunks[^1], OverlapChars), StringComparison.Ordinal))
            {
                chunks.Add(last);
            }
            else if (last.Length > TakeTail(chunks[^1], OverlapChars).Length)
            {
                chunks.Add(last);
            }
        }

        return chunks.Count > 0 ? chunks : [text];
    }

    private static List<string> SplitParagraphs(string text) =>
        text
            .Split(["\r\n\r\n", "\n\n", "\r\r"], StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Trim())
            .Where(p => p.Length > 0)
            .ToList();

    private static IEnumerable<string> HardSplit(string paragraph)
    {
        for (var offset = 0; offset < paragraph.Length; offset += TargetChunkChars - OverlapChars)
        {
            var length = Math.Min(TargetChunkChars, paragraph.Length - offset);
            yield return paragraph.Substring(offset, length);
            if (offset + length >= paragraph.Length)
            {
                yield break;
            }
        }
    }

    private static string TakeTail(string text, int maxChars)
    {
        if (string.IsNullOrEmpty(text) || text.Length <= maxChars)
        {
            return text;
        }

        // Prefer a word boundary so the overlap does not cut mid-word.
        var slice = text[^maxChars..];
        var space = slice.IndexOf(' ');
        if (space > 0 && space < slice.Length / 2)
        {
            slice = slice[(space + 1)..];
        }

        return slice;
    }
}
