using DevFlow.Domain.Common;
using DevFlow.Domain.Entities;

namespace DevFlow.UnitTests.DomainTests;

/// <summary>
/// Regression: webhook deliveries were matched to integrations by exact SQL
/// equality on repository_url, while users link whatever form they pasted
/// (ssh / www. / .git / trailing slash / any casing of the slug). A variant
/// mismatch dropped every event for that repository with a silent 202.
/// Everything converges on one canonical key: https, lowercased owner/repo.
/// </summary>
public class GitHubUrlTests
{
    [Theory]
    // The shape GitHub's webhook sends — already canonical, must round-trip.
    [InlineData("https://github.com/acme/devflow", "https://github.com/acme/devflow")]
    // Every form a user can copy from GitHub's "Code" menu or browser bar.
    [InlineData("https://github.com/acme/devflow.git", "https://github.com/acme/devflow")]
    [InlineData("https://github.com/acme/devflow/", "https://github.com/acme/devflow")]
    [InlineData("http://github.com/acme/devflow", "https://github.com/acme/devflow")]
    [InlineData("https://www.github.com/acme/devflow", "https://github.com/acme/devflow")]
    [InlineData("https://GitHub.com/Acme/DevFlow", "https://github.com/acme/devflow")]
    [InlineData("git@github.com:acme/devflow.git", "https://github.com/acme/devflow")]
    [InlineData("ssh://git@github.com/acme/devflow", "https://github.com/acme/devflow")]
    [InlineData("github.com/Acme/DevFlow", "https://github.com/acme/devflow")]
    [InlineData("  https://github.com/acme/devflow  ", "https://github.com/acme/devflow")]
    // A webhook URL carrying a subpath/query still names the same repo.
    [InlineData("https://github.com/acme/devflow/pull/7", "https://github.com/acme/devflow")]
    [InlineData("https://github.com/acme/devflow?tab=readme", "https://github.com/acme/devflow")]
    public void CanonicalizeRepository_ShouldConvergeAllForms(string input, string expected)
    {
        Assert.Equal(expected, GitHubUrl.CanonicalizeRepository(input));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("https://gitlab.com/acme/devflow")]
    [InlineData("https://github.com/acme")]
    public void CanonicalizeRepository_ShouldReturnNull_ForNonGitHubRepoUrl(string? input)
    {
        Assert.Null(GitHubUrl.CanonicalizeRepository(input));
    }

    [Fact]
    public void CanonicalizeRepository_WebhookHtmlUrl_MatchesEveryLinkedVariant()
    {
        // The concrete failure: linked via the ssh copy, delivered via html_url.
        var linked = GitHubUrl.CanonicalizeRepository("git@github.com:Acme/DevFlow.git");
        var delivered = GitHubUrl.CanonicalizeRepository("https://github.com/Acme/DevFlow");
        Assert.Equal(linked, delivered);
    }

    [Fact]
    public void GitHubIntegration_Create_ShouldStoreCanonicalUrl()
    {
        var integration = GitHubIntegration.Create(
            Guid.NewGuid(), "https://www.GitHub.com/Acme/DevFlow.git/", null);

        Assert.Equal("https://github.com/acme/devflow", integration.RepositoryUrl);
    }

    [Fact]
    public void GitHubIntegration_Create_ShouldKeepUnrecognizedUrlTrimmed()
    {
        // A non-GitHub shape is stored as pasted (minus whitespace), never
        // rewritten into a fake canonical form.
        var integration = GitHubIntegration.Create(
            Guid.NewGuid(), "  https://gitlab.com/acme/devflow  ", null);

        Assert.Equal("https://gitlab.com/acme/devflow", integration.RepositoryUrl);
    }

    [Theory]
    // The dedupe comparison tolerates display-shape noise on stored rows:
    // trailing slash, www., casing, query fragments.
    [InlineData("https://github.com/acme/devflow/pull/5", "https://github.com/acme/devflow/pull/5")]
    [InlineData("https://github.com/acme/devflow/pull/5/", "https://github.com/acme/devflow/pull/5")]
    [InlineData("https://www.github.com/Acme/DevFlow/pull/5", "https://github.com/acme/devflow/pull/5")]
    [InlineData("  https://github.com/acme/devflow/pull/5?_pjax=x  ", "https://github.com/acme/devflow/pull/5")]
    public void SamePullRequest_ShouldMatchCanonicalizedVariants(string stored, string incoming)
    {
        Assert.True(GitHubUrl.SamePullRequest(stored, incoming));
    }

    [Theory]
    [InlineData("https://github.com/acme/devflow/pull/5", "https://github.com/acme/devflow/pull/6")]
    [InlineData("https://github.com/acme/devflow/pull/5", "https://github.com/other/devflow/pull/5")]
    [InlineData("", "https://github.com/acme/devflow/pull/5")]
    [InlineData(null, null)]
    public void SamePullRequest_ShouldNotMatch_DifferentOrEmpty(string? stored, string? incoming)
    {
        Assert.False(GitHubUrl.SamePullRequest(stored, incoming));
    }
}
