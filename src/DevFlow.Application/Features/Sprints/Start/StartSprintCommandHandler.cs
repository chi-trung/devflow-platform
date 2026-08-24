using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Start;

public sealed class StartSprintCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    IWorkspaceRepository workspaceRepository,
    INotificationRepository notificationRepository,
    INotificationPreferencesRepository preferencesRepository,
    IRealtimeNotificationService realtimeNotificationService,
    IEmailService emailService,
    IOutboxDispatcher outboxDispatcher,
    IUnitOfWork unitOfWork) : IRequestHandler<StartSprintCommand>
{
    public async Task Handle(StartSprintCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var sprint = await sprintRepository.GetByIdAsync(command.SprintId, cancellationToken);

        if (sprint is null || sprint.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Sprint), command.SprintId);
        }

        if (await sprintRepository.HasActiveSprintAsync(command.ProjectId, cancellationToken))
        {
            throw new ConflictException("This project already has an active sprint. Complete it first.");
        }

        sprint.Start(command.StartDateUtc, command.EndDateUtc);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Notify all project members about the sprint start
        var members = await workspaceRepository.GetMembersAsync(command.WorkspaceId, cancellationToken);

        foreach (var (userId, email, _, _, _) in members)
        {
            var notification = Notification.Create(
                userId,
                "SprintStarted",
                $"Sprint {sprint.Name} has started",
                null,
                project.Id,
                project.WorkspaceId);

            await notificationRepository.AddAsync(notification, cancellationToken);

            await realtimeNotificationService.NotifyUserAsync(
                userId,
                "SprintStarted",
                $"Sprint {sprint.Name} has started",
                null,
                project.Id,
                project.WorkspaceId,
                cancellationToken);

            var prefs = await preferencesRepository.GetByUserIdAsync(userId, cancellationToken);
            if (prefs?.EmailOnSprintStarted != false && !string.IsNullOrWhiteSpace(email))
            {
                _ = emailService.SendSprintStartedEmailAsync(
                        email,
                        sprint.Name,
                        project.Name,
                        project.WorkspaceId.ToString(),
                        project.Id.ToString(),
                        sprint.Id.ToString())
                    .ContinueWith(_ => Task.CompletedTask, TaskContinuationOptions.OnlyOnCanceled);
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Enqueue outbox webhook event for "sprint.started"
        var webhookPayload = new
        {
            workspaceId = project.WorkspaceId,
            eventName = "sprint.started",
            data = new
            {
                sprintId = sprint.Id,
                sprintName = sprint.Name,
                projectId = project.Id,
                projectName = project.Name,
                startDateUtc = command.StartDateUtc,
                endDateUtc = command.EndDateUtc,
            },
        };

        await outboxDispatcher.EnqueueAsync("webhook.sprint.started", webhookPayload, cancellationToken);
    }
}