using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class TaskAttachment : BaseEntity, IAuditableEntity
{
    private TaskAttachment()
    {
    }

    private TaskAttachment(
        Guid taskItemId,
        string fileName,
        string contentType,
        long fileSize,
        byte[] data)
    {
        TaskItemId = taskItemId;
        FileName = fileName;
        ContentType = contentType;
        FileSize = fileSize;
        Data = data;
    }

    public Guid TaskItemId { get; private set; }

    public string FileName { get; private set; } = string.Empty;

    public string ContentType { get; private set; } = string.Empty;

    public long FileSize { get; private set; }

    public byte[] Data { get; private set; } = [];

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static TaskAttachment Create(
        Guid taskItemId,
        string fileName,
        string contentType,
        long fileSize,
        byte[] data)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new ArgumentException("File name is required.", nameof(fileName));
        }

        if (fileSize <= 0 || data.Length == 0)
        {
            throw new ArgumentException("File data cannot be empty.", nameof(data));
        }

        if (fileSize > 10 * 1024 * 1024) // 10MB limit
        {
            throw new ArgumentException("File size exceeds 10MB limit.", nameof(fileSize));
        }

        return new TaskAttachment(
            taskItemId,
            fileName.Trim(),
            contentType?.Trim() ?? "application/octet-stream",
            fileSize,
            data);
    }
}
