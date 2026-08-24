using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Workspaces.List;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.Update;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record UpdateWorkspaceCommand(
    Guid WorkspaceId,
    string Name,
    string? Description) : IRequest<WorkspaceResponse>, IWorkspaceRequest;

public sealed class UpdateWorkspaceCommandHandler(
    IWorkspaceRepository workspaceRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateWorkspaceCommand, WorkspaceResponse>
{
    public async Task<WorkspaceResponse> Handle(
        UpdateWorkspaceCommand command,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command.Name))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Name"] = ["Workspace name is required."],
            });
        }

        var workspace = await workspaceRepository.GetByIdAsync(command.WorkspaceId, cancellationToken);

        if (workspace is null)
        {
            throw new NotFoundException(nameof(Workspace), command.WorkspaceId);
        }

        workspace.UpdateDetails(command.Name, command.Description);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var role = await workspaceRepository.GetMemberRoleAsync(workspace.Id, userContext.UserId, cancellationToken);

        return new WorkspaceResponse(
            workspace.Id,
            workspace.Name,
            workspace.Slug,
            workspace.Description,
            role?.ToString() ?? "Member");
    }
}
