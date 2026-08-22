using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class CustomFieldRepository(DevFlowDbContext dbContext) : ICustomFieldRepository
{
    public async Task<IReadOnlyList<CustomField>> GetByProjectIdAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        return await dbContext.CustomFields
            .Where(f => f.ProjectId == projectId)
            .OrderBy(f => f.SortOrder)
            .ToListAsync(cancellationToken);
    }

    public Task<CustomField?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.CustomFields.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
    }

    public async Task AddAsync(CustomField field, CancellationToken cancellationToken = default)
    {
        await dbContext.CustomFields.AddAsync(field, cancellationToken);
    }

    public void Remove(CustomField field)
    {
        dbContext.CustomFields.Remove(field);
    }

    public async Task<TaskCustomFieldValue?> GetFieldValueAsync(Guid taskId, Guid fieldId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TaskCustomFieldValues
            .FirstOrDefaultAsync(v => v.TaskId == taskId && v.FieldId == fieldId, cancellationToken);
    }

    public async Task AddFieldValueAsync(TaskCustomFieldValue value, CancellationToken cancellationToken = default)
    {
        await dbContext.TaskCustomFieldValues.AddAsync(value, cancellationToken);
    }

    public async Task<IReadOnlyList<(CustomField Field, string? Value)>> GetFieldValuesForTaskAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        var results = await dbContext.TaskCustomFieldValues
            .Where(v => v.TaskId == taskId)
            .Join(
                dbContext.CustomFields,
                v => v.FieldId,
                f => f.Id,
                (v, f) => new { Field = f, v.Value })
            .ToListAsync(cancellationToken);

        return results.Select(r => (r.Field, r.Value)).ToList();
    }
}
