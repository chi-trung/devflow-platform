using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class PullRequest : BaseEntity, IAuditableEntity
{
    private PullRequest()
    {
    }

    private PullRequest(Guid projectId, string title, string url, string status, string? author, string? headBranch)
    {
        ProjectId = projectId;
        Title = title;
        Url = url;
        Status = NormalizeStatus(status);
        Author = author;
        HeadBranch = headBranch;
    }

    public Guid ProjectId { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string Url { get; private set; } = string.Empty;

    public string Status { get; private set; } = "Open"; // canonical: Open, Merged, Closed

    /// <summary>
    /// Single choke-point for status casing. Readers (frontend style maps)
    /// key off "Open"/"Merged"/"Closed", but writers drifted: the manual
    /// add-PR form submits the raw lowercase select value while the webhook
    /// writes capitalized strings — case-sensitive JS lookups then rendered
    /// open manual PRs as "Closed" badges. Normalize at construction/update
    /// so every row carries one canonical casing regardless of the writer.
    /// Unknown values pass through trimmed rather than being silently mapped.
    /// </summary>
    private static string NormalizeStatus(string status)
    {
        var trimmed = status.Trim();
        return trimmed.ToLowerInvariant() switch
        {
            "open" => "Open",
            "merged" => "Merged",
            "closed" => "Closed",
            _ => trimmed,
        };
    }

    public string? Author { get; private set; }

    /// <summary>
    /// Git branch this PR merges from (null for rows created before the field
    /// existed or entered via the manual add form).
    /// </summary>
    public string? HeadBranch { get; private set; }

    public Guid? LinkedTaskId { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static PullRequest Create(Guid projectId, string title, string url, string status, string? author)
    {
        return new PullRequest(projectId, title, url, status, author, headBranch: null);
    }

    public static PullRequest Create(Guid projectId, string title, string url, string status, string? author, string? headBranch)
    {
        return new PullRequest(projectId, title, url, status, author, headBranch);
    }

    public void UpdateStatus(string status) => Status = NormalizeStatus(status);

    public void LinkToTask(Guid taskId) => LinkedTaskId = taskId;
}
