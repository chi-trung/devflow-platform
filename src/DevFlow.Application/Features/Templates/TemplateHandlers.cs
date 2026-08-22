using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Templates;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListTemplatesQuery(Guid WorkspaceId, Guid ProjectId) : IRequest<List<TemplateResponse>>, IWorkspaceRequest;

public class ListTemplatesHandler(ITemplateRepository repo) : IRequestHandler<ListTemplatesQuery, List<TemplateResponse>>
{
    public async Task<List<TemplateResponse>> Handle(ListTemplatesQuery request, CancellationToken ct)
    {
        var templates = await repo.GetByProjectIdAsync(request.ProjectId, ct);
        return templates.Select(t => new TemplateResponse(t.Id, t.ProjectId, t.Name, t.Title, t.Description, t.Priority.ToString(), t.EstimateMinutes)).ToList();
    }
}

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record CreateTemplateCommand(Guid WorkspaceId, Guid ProjectId, string Name, string? Title, string? Description, string Priority, int? EstimateMinutes) : IRequest<Guid>, IWorkspaceRequest;

public class CreateTemplateHandler(ITemplateRepository repo, IUnitOfWork uow) : IRequestHandler<CreateTemplateCommand, Guid>
{
    public async Task<Guid> Handle(CreateTemplateCommand request, CancellationToken ct)
    {
        var priority = Enum.TryParse<TaskItemPriority>(request.Priority, true, out var p) ? p : TaskItemPriority.Medium;
        var template = Domain.Entities.TaskTemplate.Create(request.ProjectId, request.Name, request.Title, request.Description, priority, request.EstimateMinutes);
        await repo.AddAsync(template, ct);
        await uow.SaveChangesAsync(ct);
        return template.Id;
    }
}

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ApplyTemplateCommand(Guid WorkspaceId, Guid ProjectId, Guid TemplateId) : IRequest<Guid>, IWorkspaceRequest;

public class ApplyTemplateHandler(ITemplateRepository repo, ITaskItemRepository taskRepo, IUnitOfWork uow) : IRequestHandler<ApplyTemplateCommand, Guid>
{
    public async Task<Guid> Handle(ApplyTemplateCommand request, CancellationToken ct)
    {
        var template = await repo.GetByIdAsync(request.TemplateId, ct)
            ?? throw new NotFoundException(nameof(Domain.Entities.TaskTemplate), request.TemplateId);

        var task = Domain.Entities.TaskItem.Create(request.ProjectId, template.Title ?? template.Name, template.Description, template.Priority);
        if (template.EstimateMinutes.HasValue) task.SetEstimate(template.EstimateMinutes.Value);

        await taskRepo.AddAsync(task, ct);
        await uow.SaveChangesAsync(ct);
        return task.Id;
    }
}

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record DeleteTemplateCommand(Guid WorkspaceId, Guid ProjectId, Guid TemplateId) : IRequest, IWorkspaceRequest;

public class DeleteTemplateHandler(ITemplateRepository repo, IUnitOfWork uow) : IRequestHandler<DeleteTemplateCommand>
{
    public async Task Handle(DeleteTemplateCommand request, CancellationToken ct)
    {
        var template = await repo.GetByIdAsync(request.TemplateId, ct)
            ?? throw new NotFoundException(nameof(Domain.Entities.TaskTemplate), request.TemplateId);
        repo.Remove(template);
        await uow.SaveChangesAsync(ct);
    }
}

public sealed record TemplateResponse(Guid Id, Guid ProjectId, string Name, string? Title, string? Description, string Priority, int? EstimateMinutes);
