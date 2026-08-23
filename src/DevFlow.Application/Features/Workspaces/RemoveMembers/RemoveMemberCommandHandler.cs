using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.RemoveMembers;

public sealed class RemoveMemberCommandHandler(
    IWorkspaceRepository workspaceRepository,
    IUserRepository userRepository,
    IUserContext userContext,
    IActivityLogRepository activityLogRepository,
    ICacheService cacheService,
    IUnitOfWork unitOfWork) : IRequestHandler<RemoveMemberCommand>
{
    public async Task Handle(RemoveMemberCommand command, CancellationToken cancellationToken)
    {
        var workspace = await workspaceRepository.GetByIdAsync(command.WorkspaceId, cancellationToken)
            ?? throw new NotFoundException(nameof(Workspace), command.WorkspaceId);

        var currentUserRole = await workspaceRepository.GetMemberRoleAsync(
            command.WorkspaceId, userContext.UserId, cancellationToken)
            ?? throw new ForbiddenAccessException();

        var targetUserRole = await workspaceRepository.GetMemberRoleAsync(
            command.WorkspaceId, command.UserId, cancellationToken)
            ?? throw new NotFoundException("WorkspaceMember", command.UserId);

        if (command.UserId == userContext.UserId)
        {
            throw new ConflictException("You cannot remove yourself from the workspace.");
        }

        if (currentUserRole == WorkspaceRole.Admin && targetUserRole != WorkspaceRole.Member)
        {
            throw new ForbiddenAccessException();
        }

        await workspaceRepository.RemoveMemberAsync(command.WorkspaceId, command.UserId, cancellationToken);
        await cacheService.RemoveAsync($"workspace-members:{command.WorkspaceId}", cancellationToken);

        var actor = await userRepository.GetByIdAsync(userContext.UserId, cancellationToken);
        var actorName = actor?.DisplayName ?? "Someone";
        var targetUser = await userRepository.GetByIdAsync(command.UserId, cancellationToken);
        var targetName = targetUser?.DisplayName ?? "User";

        var log = Domain.Entities.ActivityLog.Create(
            command.WorkspaceId,
            Guid.Empty,
            null,
            userContext.UserId,
            "removed",
            $"{targetName} from workspace");
        await activityLogRepository.AddAsync(log, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}