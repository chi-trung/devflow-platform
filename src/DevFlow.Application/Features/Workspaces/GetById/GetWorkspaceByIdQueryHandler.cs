using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Workspaces.List;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.GetById;

public sealed class GetWorkspaceByIdQueryHandler(
    IWorkspaceRepository workspaceRepository,
    IUserContext userContext) : IRequestHandler<GetWorkspaceByIdQuery, WorkspaceResponse>
{
    public async Task<WorkspaceResponse> Handle(
        GetWorkspaceByIdQuery query,
        CancellationToken cancellationToken)
    {
        var workspace = await workspaceRepository.GetByIdAsync(query.WorkspaceId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.Workspace), query.WorkspaceId);

        var role = await workspaceRepository.GetMemberRoleAsync(workspace.Id, userContext.UserId, cancellationToken);

        if (role is null)
        {
            throw new ForbiddenAccessException();
        }

        return new WorkspaceResponse(
            workspace.Id,
            workspace.Name,
            workspace.Slug,
            workspace.Description,
            role.Value.ToString());
    }
}
