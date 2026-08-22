using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class Label : BaseEntity, IAuditableEntity
{
    private Label()
    {
    }

    private Label(Guid projectId, string name, string color)
    {
        ProjectId = projectId;
        Name = name;
        Color = color;
    }

    public Guid ProjectId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string Color { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static Label Create(Guid projectId, string name, string color)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(color))
        {
            throw new ArgumentException("Color is required.", nameof(color));
        }

        return new Label(projectId, name.Trim(), color.Trim());
    }

    public void UpdateDetails(string name, string color)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(color))
        {
            throw new ArgumentException("Color is required.", nameof(color));
        }

        Name = name.Trim();
        Color = color.Trim();
    }
}
