using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Templates;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record UpdateTemplateCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TemplateId,
    string Name,
    string? Description) : IRequest<TemplateResponse>, IWorkspaceRequest;

public class UpdateTemplateHandler(
    ITemplateRepository repo,
    IProjectRepository projectRepository,
    IUnitOfWork uow) : IRequestHandler<UpdateTemplateCommand, TemplateResponse>
{
    public async Task<TemplateResponse> Handle(UpdateTemplateCommand request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Name"] = ["Template name is required."],
            });
        }

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

        template.Update(request.Name, template.Title, request.Description, template.Priority, template.EstimateMinutes);
        await uow.SaveChangesAsync(ct);

        return new TemplateResponse(
            template.Id,
            template.ProjectId,
            template.Name,
            template.Title,
            template.Description,
            template.Priority.ToString(),
            template.EstimateMinutes);
    }
}
