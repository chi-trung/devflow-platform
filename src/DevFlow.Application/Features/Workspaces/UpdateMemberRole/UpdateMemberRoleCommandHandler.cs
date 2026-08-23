using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.UpdateMemberRole;

public sealed class UpdateMemberRoleCommandHandler(
    IWorkspaceRepository workspaceRepository,
    IUserRepository userRepository,
    IUserContext userContext,
    IActivityLogRepository activityLogRepository,
    ICacheService cacheService,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateMemberRoleCommand>
{
    public async Task Handle(UpdateMemberRoleCommand command, CancellationToken cancellationToken)
    {
        var workspace = await workspaceRepository.GetByIdAsync(command.WorkspaceId, cancellationToken)
            ?? throw new NotFoundException(nameof(Workspace), command.WorkspaceId);

        var currentUserRole = await workspaceRepository.GetMemberRoleAsync(
            command.WorkspaceId, userContext.UserId, cancellationToken)
            ?? throw new ForbiddenAccessException();

        if (currentUserRole != WorkspaceRole.Owner)
        {
            throw new ForbiddenAccessException();
        }

        if (command.UserId == userContext.UserId)
        {
            throw new ConflictException("You cannot change your own role.");
        }

        var targetUserRole = await workspaceRepository.GetMemberRoleAsync(
            command.WorkspaceId, command.UserId, cancellationToken)
            ?? throw new NotFoundException("WorkspaceMember", command.UserId);

        if (targetUserRole == command.Role)
        {
            throw new ConflictException("The user already has this role.");
        }

        await workspaceRepository.UpdateMemberRoleAsync(command.WorkspaceId, command.UserId, command.Role, cancellationToken);
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
            "changed role of",
            $"{targetName} to {command.Role}");
        await activityLogRepository.AddAsync(log, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}