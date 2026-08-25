using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.CustomFields;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListCustomFieldsQuery(Guid WorkspaceId, Guid ProjectId) : IRequest<List<CustomFieldResponse>>, IWorkspaceRequest;

public class ListCustomFieldsHandler(ICustomFieldRepository repo) : IRequestHandler<ListCustomFieldsQuery, List<CustomFieldResponse>>
{
    public async Task<List<CustomFieldResponse>> Handle(ListCustomFieldsQuery request, CancellationToken ct)
    {
        var fields = await repo.GetByProjectIdAsync(request.ProjectId, ct);
        return fields.Select(f => new CustomFieldResponse(f.Id, f.ProjectId, f.Name, f.FieldType, f.Options, f.IsRequired, f.SortOrder)).ToList();
    }
}

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record CreateCustomFieldCommand(Guid WorkspaceId, Guid ProjectId, string Name, string FieldType, string? Options, bool IsRequired) : IRequest<Guid>, IWorkspaceRequest;

public class CreateCustomFieldHandler(ICustomFieldRepository repo, IUnitOfWork uow) : IRequestHandler<CreateCustomFieldCommand, Guid>
{
    public async Task<Guid> Handle(CreateCustomFieldCommand request, CancellationToken ct)
    {
        var field = Domain.Entities.CustomField.Create(request.ProjectId, request.Name, request.FieldType, request.Options, request.IsRequired);
        await repo.AddAsync(field, ct);
        await uow.SaveChangesAsync(ct);
        return field.Id;
    }
}

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record SetCustomFieldValueCommand(Guid WorkspaceId, Guid ProjectId, Guid TaskId, Guid FieldId, string? Value) : IRequest, IWorkspaceRequest;

public class SetCustomFieldValueHandler(ICustomFieldRepository repo, IUnitOfWork uow) : IRequestHandler<SetCustomFieldValueCommand>
{
    public async Task Handle(SetCustomFieldValueCommand request, CancellationToken ct)
    {
        var field = await repo.GetByIdAsync(request.FieldId, ct)
            ?? throw new NotFoundException(nameof(Domain.Entities.CustomField), request.FieldId);

        var existing = await repo.GetFieldValueAsync(request.TaskId, request.FieldId, ct);
        if (existing != null)
        {
            existing.UpdateValue(request.Value);
        }
        else
        {
            var value = Domain.Entities.TaskCustomFieldValue.Create(request.TaskId, request.FieldId, request.Value);
            await repo.AddFieldValueAsync(value, ct);
        }
        await uow.SaveChangesAsync(ct);
    }
}

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetTaskCustomFieldValuesQuery(Guid WorkspaceId, Guid ProjectId, Guid TaskId) : IRequest<List<CustomFieldValueResponse>>, IWorkspaceRequest;

public class GetTaskCustomFieldValuesHandler(ICustomFieldRepository repo) : IRequestHandler<GetTaskCustomFieldValuesQuery, List<CustomFieldValueResponse>>
{
    public async Task<List<CustomFieldValueResponse>> Handle(GetTaskCustomFieldValuesQuery request, CancellationToken ct)
    {
        var values = await repo.GetFieldValuesForTaskAsync(request.TaskId, ct);
        return values.Select(v => new CustomFieldValueResponse(v.Field.Id, v.Field.Name, v.Field.FieldType, v.Value)).ToList();
    }
}

/// <summary>Custom-field values for every task in a project, in one query.</summary>
public sealed record ProjectCustomFieldValuesResponse(
    Guid TaskId,
    IReadOnlyList<CustomFieldValueResponse> Values);

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetProjectCustomFieldValuesQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<List<ProjectCustomFieldValuesResponse>>, IWorkspaceRequest;

public class GetProjectCustomFieldValuesHandler(ICustomFieldRepository repo)
    : IRequestHandler<GetProjectCustomFieldValuesQuery, List<ProjectCustomFieldValuesResponse>>
{
    public async Task<List<ProjectCustomFieldValuesResponse>> Handle(
        GetProjectCustomFieldValuesQuery request, CancellationToken ct)
    {
        // One grouped query instead of one per task (the board renders up to
        // 100 cards; the per-task endpoint was an N+1 that made project loads
        // slow on cold tiers).
        var values = await repo.GetFieldValuesForProjectAsync(request.ProjectId, ct);
        return values
            .GroupBy(v => v.TaskId)
            .Select(g => new ProjectCustomFieldValuesResponse(
                g.Key,
                g.Select(v => new CustomFieldValueResponse(
                    v.Field.Id, v.Field.Name, v.Field.FieldType, v.Value)).ToList()))
            .ToList();
    }
}

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record UpdateCustomFieldCommand(Guid WorkspaceId, Guid ProjectId, Guid FieldId, string Name, string FieldType, string? Options, bool IsRequired, int SortOrder) : IRequest, IWorkspaceRequest;

public class UpdateCustomFieldHandler(ICustomFieldRepository repo, IUnitOfWork uow) : IRequestHandler<UpdateCustomFieldCommand>
{
    public async Task Handle(UpdateCustomFieldCommand request, CancellationToken ct)
    {
        var field = await repo.GetByIdAsync(request.FieldId, ct)
            ?? throw new NotFoundException(nameof(Domain.Entities.CustomField), request.FieldId);

        field.Update(request.Name, request.Options, request.IsRequired, request.SortOrder, request.FieldType);
        await uow.SaveChangesAsync(ct);
    }
}

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record DeleteCustomFieldCommand(Guid WorkspaceId, Guid ProjectId, Guid FieldId) : IRequest, IWorkspaceRequest;

public class DeleteCustomFieldHandler(ICustomFieldRepository repo, IUnitOfWork uow) : IRequestHandler<DeleteCustomFieldCommand>
{
    public async Task Handle(DeleteCustomFieldCommand request, CancellationToken ct)
    {
        var field = await repo.GetByIdAsync(request.FieldId, ct)
            ?? throw new NotFoundException(nameof(Domain.Entities.CustomField), request.FieldId);
        repo.Remove(field);
        await uow.SaveChangesAsync(ct);
    }
}

public sealed record CustomFieldResponse(Guid Id, Guid ProjectId, string Name, string FieldType, string? Options, bool IsRequired, int SortOrder);
public sealed record CustomFieldValueResponse(Guid FieldId, string FieldName, string FieldType, string? Value);
