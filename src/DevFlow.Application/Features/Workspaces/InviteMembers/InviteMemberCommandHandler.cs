using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.InviteMembers;

/// <summary>
/// Creates a pending invitation instead of adding membership directly —
/// the invitee must Accept before they appear in the members list.
/// </summary>
public sealed class InviteMemberCommandHandler(
    IWorkspaceRepository workspaceRepository,
    IUserRepository userRepository,
    IWorkspaceInvitationRepository invitationRepository,
    INotificationRepository notificationRepository,
    IUserContext userContext,
    IEmailService emailService,
    IUnitOfWork unitOfWork) : IRequestHandler<InviteMemberCommand, MemberResponse>
{
    public async Task<MemberResponse> Handle(InviteMemberCommand command, CancellationToken cancellationToken)
    {
        var email = command.Email.Trim().ToLowerInvariant();

        var user = await userRepository.GetByEmailAsync(email, cancellationToken)
            ?? throw new NotFoundException(nameof(User), email);

        var workspace = await workspaceRepository.GetByIdAsync(command.WorkspaceId, cancellationToken)
            ?? throw new NotFoundException(nameof(Workspace), command.WorkspaceId);

        var existingRole = await workspaceRepository.GetMemberRoleAsync(
            command.WorkspaceId, user.Id, cancellationToken);

        if (existingRole is not null)
        {
            throw new ConflictException($"User \"{email}\" is already a member of this workspace.");
        }

        var pending = await invitationRepository.GetPendingAsync(
            command.WorkspaceId, user.Id, cancellationToken);

        if (pending is not null)
        {
            throw new ConflictException($"User \"{email}\" already has a pending invitation to this workspace.");
        }

        var invitation = WorkspaceInvitation.Create(
            command.WorkspaceId,
            user.Id,
            email,
            command.Role,
            userContext.UserId);

        await invitationRepository.AddAsync(invitation, cancellationToken);

        // In-app notification so the invitee sees the invite without leaving the app.
        // Created inside the handler because INotificationEvent cannot resolve
        // email → user id before the handler runs.
        var inviter = await userRepository.GetByIdAsync(userContext.UserId, cancellationToken);
        var inviterName = inviter?.DisplayName ?? "Someone";
        var notification = Notification.Create(
            user.Id,
            "WorkspaceInvited",
            $"{inviterName} invited you to join {workspace.Name} as {command.Role}.",
            workspaceId: command.WorkspaceId,
            actorUserId: userContext.UserId);
        await notificationRepository.AddAsync(notification, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Fire-and-forget email; invitation is already persisted.
        if (!string.IsNullOrWhiteSpace(user.Email))
        {
            _ = emailService.SendWorkspaceInviteEmailAsync(
                    user.Email,
                    workspace.Name,
                    inviterName,
                    command.Role.ToString(),
                    command.WorkspaceId.ToString())
                .ContinueWith(_ => Task.CompletedTask, TaskContinuationOptions.OnlyOnCanceled);
        }

        return new MemberResponse(user.Id, user.Email, command.Role.ToString());
    }
}
