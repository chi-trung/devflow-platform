using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ICustomFieldRepository
{
    Task<IReadOnlyList<CustomField>> GetByProjectIdAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<CustomField?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(CustomField field, CancellationToken cancellationToken = default);

    void Remove(CustomField field);

    Task<TaskCustomFieldValue?> GetFieldValueAsync(Guid taskId, Guid fieldId, CancellationToken cancellationToken = default);

    Task AddFieldValueAsync(TaskCustomFieldValue value, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<(CustomField Field, string? Value)>> GetFieldValuesForTaskAsync(Guid taskId, CancellationToken cancellationToken = default);
}
