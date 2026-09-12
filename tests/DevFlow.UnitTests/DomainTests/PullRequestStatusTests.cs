using DevFlow.Domain.Entities;

namespace DevFlow.UnitTests.DomainTests;

/// <summary>
/// Regression: the manual add-PR form stored lowercase select values
/// ("open") while the webhook wrote capitalized ones ("Open"); the
/// frontend's case-sensitive style maps then rendered an open manual PR
/// as a gray "Closed" badge. Status must carry one canonical casing no
/// matter which writer created the row.
/// </summary>
public class PullRequestStatusTests
{
    private static PullRequest New(string status) =>
        PullRequest.Create(Guid.NewGuid(), "title", "https://github.com/acme/devflow/pull/1", status, "bob");

    [Theory]
    [InlineData("open", "Open")]
    [InlineData("Open", "Open")]
    [InlineData("OPEN", "Open")]
    [InlineData("  open  ", "Open")]
    [InlineData("merged", "Merged")]
    [InlineData("Merged", "Merged")]
    [InlineData("MERGED", "Merged")]
    [InlineData("closed", "Closed")]
    [InlineData("Closed", "Closed")]
    public void Create_ShouldCanonicalizeStatus(string input, string expected)
    {
        Assert.Equal(expected, New(input).Status);
    }

    [Fact]
    public void Create_ShouldPassThroughUnknownStatus()
    {
        // Never silently map an unrecognized value into a valid bucket.
        Assert.Equal("Abandoned", New("Abandoned").Status);
    }

    [Fact]
    public void UpdateStatus_ShouldCanonicalize()
    {
        var pr = New("open");
        pr.UpdateStatus("MERGED");
        Assert.Equal("Merged", pr.Status);
    }
}
