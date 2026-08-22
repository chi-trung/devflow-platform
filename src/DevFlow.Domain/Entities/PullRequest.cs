using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class PullRequest : BaseEntity, IAuditableEntity
{
    private PullRequest()
    {
    }

    private PullRequest(Guid projectId, string title, string url, string status, string? author)
    {
        ProjectId = projectId;
        Title = title;
        Url = url;
        Status = status;
        Author = author;
    }

    public Guid ProjectId { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string Url { get; private set; } = string.Empty;

    public string Status { get; private set; } = "open"; // open, merged, closed

    public string? Author { get; private set; }

    public Guid? LinkedTaskId { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static PullRequest Create(Guid projectId, string title, string url, string status, string? author)
    {
        return new PullRequest(projectId, title, url, status, author);
    }

    public void UpdateStatus(string status) => Status = status;

    public void LinkToTask(Guid taskId) => LinkedTaskId = taskId;
}
