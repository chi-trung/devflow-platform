using System.Collections.Concurrent;
using System.Text.RegularExpressions;

namespace DevFlow.Application.Features.GitHub;

public static class TaskKeyParser
{
    // Built per project key (keys can contain digits — "SPB2-1" — so a generic
    // letters-only regex would miss them). One per project, so cache compiled.
    private static readonly ConcurrentDictionary<string, Regex> KeyRegexes = new(StringComparer.OrdinalIgnoreCase);

    public static List<string> ParseKeys(string? text, string projectKey)
    {
        if (string.IsNullOrWhiteSpace(text))
            return [];

        var regex = KeyRegexes.GetOrAdd(projectKey, static key => new Regex(
            $@"\b{Regex.Escape(key)}-(\d+)(?!\d)",
            RegexOptions.Compiled | RegexOptions.IgnoreCase));

        var matches = regex.Matches(text);
        var keys = new List<string>();

        foreach (Match match in matches)
        {
            keys.Add(match.Value.ToUpperInvariant());
        }

        return keys.Distinct().ToList();
    }
}
