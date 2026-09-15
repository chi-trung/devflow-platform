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

// IProjectEvent: applying a template writes a real TaskItem into the
// project, so the board's tasks:* cache (and dashboard counts) must drop
// with it — without the marker the new task stays invisible for the 30s
// cache TTL. ActivityVerb stays empty → no activity-log entry.
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ApplyTemplateCommand(Guid WorkspaceId, Guid ProjectId, Guid TemplateId) : IRequest<Guid>, IWorkspaceRequest, IProjectEvent;

public class ApplyTemplateHandler(
    ITemplateRepository repo,
    ITaskItemRepository taskRepo,
    IProjectRepository projectRepository,
    IUnitOfWork uow) : IRequestHandler<ApplyTemplateCommand, Guid>
{
    public async Task<Guid> Handle(ApplyTemplateCommand request, CancellationToken ct)
    {
        // Route ids are attacker-shaped: pin the project to the workspace
        // the behavior already checked membership for, and pin the
        // template to the project so a foreign template id can't be
        // probed/applied across projects.
        var project = await projectRepository.GetByIdAsync(request.ProjectId, ct);

        if (project is null || project.WorkspaceId != request.WorkspaceId)
        {
            throw new NotFoundException(nameof(Domain.Entities.Project), request.ProjectId);
        }

        var template = await repo.GetByIdAsync(request.TemplateId, ct)
            ?? throw new NotFoundException(nameof(Domain.Entities.TaskTemplate), request.TemplateId);

        if (template.ProjectId != request.ProjectId)
        {
            throw new NotFoundException(nameof(Domain.Entities.TaskTemplate), request.TemplateId);
        }

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
