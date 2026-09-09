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
        Status = status;
        Author = author;
        HeadBranch = headBranch;
    }

    public Guid ProjectId { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string Url { get; private set; } = string.Empty;

    public string Status { get; private set; } = "open"; // open, merged, closed

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

    public void UpdateStatus(string status) => Status = status;

    public void LinkToTask(Guid taskId) => LinkedTaskId = taskId;
}
