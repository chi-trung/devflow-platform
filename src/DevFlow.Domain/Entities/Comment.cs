using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class Comment : BaseEntity, IAuditableEntity
{
    private Comment()
    {
    }

    private Comment(Guid taskItemId, Guid authorId, string content)
    {
        TaskItemId = taskItemId;
        AuthorId = authorId;
        Content = content;
    }

    public Guid TaskItemId { get; private set; }

    public Guid AuthorId { get; private set; }

    public string Content { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static Comment Create(Guid taskItemId, Guid authorId, string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ArgumentException("Content is required.", nameof(content));
        }

        return new Comment(taskItemId, authorId, content.Trim());
    }

    public void Edit(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ArgumentException("Content is required.", nameof(content));
        }

        Content = content.Trim();
    }
}
