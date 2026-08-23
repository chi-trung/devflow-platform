using System.Text.RegularExpressions;

namespace DevFlow.Application.Features.GitHub;

public static class TaskKeyParser
{
    private static readonly Regex TaskKeyRegex = new(@"\b([A-Z]{2,10})-(\d+)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static List<string> ParseKeys(string? text, string projectKey)
    {
        if (string.IsNullOrWhiteSpace(text))
            return [];

        var matches = TaskKeyRegex.Matches(text);
        var keys = new List<string>();

        foreach (Match match in matches)
        {
            var key = match.Groups[1].Value.ToUpperInvariant();
            if (key == projectKey.ToUpperInvariant())
            {
                keys.Add(match.Value.ToUpperInvariant());
            }
        }

        return keys.Distinct().ToList();
    }
}
