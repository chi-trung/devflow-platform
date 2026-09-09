using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Create;

public sealed class CreateTaskItemCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateTaskItemCommand, TaskItemCreatedResponse>
{
    private const int MaxSaveAttempts = 3;

    public async Task<TaskItemCreatedResponse> Handle(
        CreateTaskItemCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var task = TaskItem.Create(
            command.ProjectId,
            command.Title,
            command.Description,
            command.Priority);

        if (!string.IsNullOrWhiteSpace(command.DefinitionOfDone))
        {
            task.SetDefinitionOfDone(command.DefinitionOfDone);
        }

        task.SetNumber(await taskItemRepository.GetMaxNumberAsync(command.ProjectId, cancellationToken) + 1);

        await taskItemRepository.AddAsync(task, cancellationToken);

        var log = ActivityLog.Create(
            command.WorkspaceId,
            command.ProjectId,
            task.Id,
            userContext.UserId,
            "created task",
            task.Title);
        await activityLog.AddAsync(log, cancellationToken);

        // Two tasks created at the same moment can race on Max+1; the
        // (project_id, number) unique index is the source of truth — re-query
        // and retry a bounded number of times before giving up.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
                break;
            }
            catch (Exception ex) when (
                attempt < MaxSaveAttempts &&
                IsUniqueViolation(ex))
            {
                task.SetNumber(await taskItemRepository.GetMaxNumberAsync(command.ProjectId, cancellationToken) + 1);
            }
        }

        return new TaskItemCreatedResponse(task.Id);
    }

    private static bool IsUniqueViolation(Exception ex)
    {
        // Npgsql embeds the Postgres SQLSTATE (23505 = unique_violation) in the
        // exception text. Matched as a string so the Application layer needs no
        // EF Core reference. Any unique violation here is safe to retry — the
        // only concurrent-insert-prone index on task_items is
        // (project_id, number).
        return ex.Message.Contains("23505", StringComparison.Ordinal) ||
               ex.InnerException?.Message.Contains("23505", StringComparison.Ordinal) == true;
    }
}
