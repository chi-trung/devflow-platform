using System.Text.RegularExpressions;

namespace DevFlow.Domain.Common;

/// <summary>
/// Canonical forms for GitHub URLs so the two sides of the repository_url
/// equality join can never drift. The webhook controller matches a delivery's
/// <c>repository.html_url</c> against the stored integration by exact,
/// case-sensitive SQL equality — but users paste whatever form they copied
/// from GitHub (https or ssh, <c>www.</c>, a ".git" suffix, a trailing slash,
/// any casing of the owner/repo slug), and a variant mismatch dropped the
/// delivery with a silent 202: the event never landed and nothing said so.
/// Store-side and both lookup call sites funnel through
/// <see cref="CanonicalizeRepository"/>, which normalizes shape and
/// lowercases owner/repo (GitHub slugs are case-insensitive), so every form
/// of the same repository converges on one key.
/// </summary>
public static partial class GitHubUrl
{
    /// <summary>
    /// Maps any recognizable GitHub repository URL to
    /// "https://github.com/{owner}/{repo}" with lowercased slug. Returns null
    /// when the input is not a GitHub repo URL — callers then keep whatever
    /// they had (trimmed) rather than storing a lie about an unknown shape.
    /// </summary>
    public static string? CanonicalizeRepository(string? repositoryUrl)
    {
        if (!TryParseRepository(repositoryUrl, out var owner, out var repo))
            return null;

        return $"https://github.com/{owner.ToLowerInvariant()}/{repo.ToLowerInvariant()}";
    }

    /// <summary>
    /// Lowercased, trimmed, <c>www.</c>- and ".git"-stripped, trailing-slash-
    /// and query-free form of a pull-request URL. Used only for equality
    /// comparisons (webhook dedupe against rows from the manual add-PR form);
    /// stored URLs keep their original casing for display and linking.
    /// </summary>
    public static string CanonicalizePullRequest(string? pullRequestUrl)
    {
        var url = (pullRequestUrl ?? string.Empty).Trim().ToLowerInvariant();
        if (url.Length == 0)
            return string.Empty;

        if (url.StartsWith("www.", StringComparison.Ordinal))
            url = "https://" + url;
        url = url.Replace("://www.", "://", StringComparison.Ordinal);

        var cut = url.IndexOfAny(['?', '#']);
        if (cut >= 0)
            url = url[..cut];

        return url.TrimEnd('/');
    }

    public static bool SamePullRequest(string? left, string? right)
    {
        var leftCanonical = CanonicalizePullRequest(left);
        return leftCanonical.Length > 0
            && string.Equals(leftCanonical, CanonicalizePullRequest(right), StringComparison.Ordinal);
    }

    private static bool TryParseRepository(string? repositoryUrl, out string owner, out string repo)
    {
        owner = string.Empty;
        repo = string.Empty;
        if (string.IsNullOrWhiteSpace(repositoryUrl))
            return false;

        var match = RepositoryPattern().Match(repositoryUrl.Trim());
        if (!match.Success)
            return false;

        owner = match.Groups["owner"].Value;
        repo = match.Groups["repo"].Value;
        return owner.Length > 0 && repo.Length > 0;
    }

    // Covers https/ssh (scp-style "git@github.com:owner/repo" and
    // "ssh://git@github.com/owner/repo"), optional www., ".git" suffix, a
    // trailing slash or subpath (?x, #frag, /pull/7 all end at the repo).
    [GeneratedRegex(
        @"^(?:(?:https?|ssh)://)?(?:[A-Za-z0-9._-]+@)?(?:www\.)?github\.com[/:](?<owner>[^/]+)/(?<repo>[^/?#]+?)(?:\.git)?(?:[/#?].*)?$",
        RegexOptions.IgnoreCase)]
    private static partial Regex RepositoryPattern();
}
