using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Import;

public sealed class ImportTasksCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<ImportTasksCommand, ImportTasksResult>
{
    public async Task<ImportTasksResult> Handle(ImportTasksCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        // The route's workspaceId used to be ignored entirely — a caller could
        // name any project id in the system. Reject cross-tenant writes with
        // the same 404 shape used by every sibling handler.
        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        int imported = 0;
        int skipped = 0;
        var errors = new List<string>();

        foreach (var row in command.Rows)
        {
            if (string.IsNullOrWhiteSpace(row.Title))
            {
                skipped++;
                continue;
            }

            // Backward-compat: pre-7-stage CSVs used "Backlog" — map it to the
            // new default stage "Idea" so old exports still import cleanly.
            var statusText = string.Equals(row.Status, "Backlog", StringComparison.OrdinalIgnoreCase)
                ? nameof(TaskItemStatus.Idea)
                : row.Status;

            if (!Enum.TryParse<TaskItemStatus>(statusText, true, out var status))
            {
                errors.Add($"Invalid status '{row.Status}' for task '{row.Title}'.");
                skipped++;
                continue;
            }

            if (!Enum.TryParse<TaskItemPriority>(row.Priority, true, out var priority))
            {
                errors.Add($"Invalid priority '{row.Priority}' for task '{row.Title}'.");
                skipped++;
                continue;
            }

            var task = TaskItem.Create(
                project.Id,
                row.Title.Trim(),
                row.Description?.Trim(),
                priority);

            if (status != TaskItemStatus.Idea)
            {
                task.ChangeStatus(status);
            }

            await taskItemRepository.AddAsync(task, cancellationToken);
            imported++;
        }

        if (imported > 0)
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new ImportTasksResult(imported, skipped, errors);
    }
}
