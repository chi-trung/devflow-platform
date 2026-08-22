using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class CustomField : BaseEntity, IAuditableEntity
{
    private CustomField()
    {
    }

    private CustomField(Guid projectId, string name, string fieldType, string? options)
    {
        ProjectId = projectId;
        Name = name;
        FieldType = fieldType; // text, number, date, select, multi-select
        Options = options; // JSON array for select fields
        IsRequired = false;
    }

    public Guid ProjectId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string FieldType { get; private set; } = "text";

    public string? Options { get; private set; }

    public bool IsRequired { get; private set; }

    public int SortOrder { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static CustomField Create(Guid projectId, string name, string fieldType, string? options)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Field name is required.", nameof(name));

        var validTypes = new[] { "text", "number", "date", "select", "multi-select" };
        if (!validTypes.Contains(fieldType.ToLower()))
            throw new ArgumentException($"Invalid field type. Valid types: {string.Join(", ", validTypes)}", nameof(fieldType));

        return new CustomField(projectId, name.Trim(), fieldType.ToLower(), options);
    }

    public void Update(string name, string? options, bool isRequired, int sortOrder)
    {
        Name = name.Trim();
        Options = options;
        IsRequired = isRequired;
        SortOrder = sortOrder;
    }
}

public class TaskCustomFieldValue : BaseEntity
{
    private TaskCustomFieldValue()
    {
    }

    private TaskCustomFieldValue(Guid taskId, Guid fieldId, string? value)
    {
        TaskId = taskId;
        FieldId = fieldId;
        Value = value;
    }

    public Guid TaskId { get; private set; }

    public Guid FieldId { get; private set; }

    public string? Value { get; private set; }

    public static TaskCustomFieldValue Create(Guid taskId, Guid fieldId, string? value)
    {
        return new TaskCustomFieldValue(taskId, fieldId, value);
    }

    public void UpdateValue(string? value) => Value = value;
}
