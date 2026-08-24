using System.Reflection;
using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Common;
using ExportData = DevFlow.Application.Features.Export.ProjectBackupData;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Import;

internal static class EntityIdSetter
{
    private static readonly PropertyInfo IdProperty = typeof(BaseEntity)
        .GetProperty(nameof(BaseEntity.Id))!;

    public static void SetId(BaseEntity entity, Guid id)
    {
        IdProperty.SetValue(entity, id);
    }
}

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ImportProjectBackupCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string JsonData) : IRequest<ImportBackupResult>, IWorkspaceRequest;

public class ImportProjectBackupHandler(
    ITaskItemRepository taskItemRepository,
    IEpicRepository epicRepository,
    ISprintRepository sprintRepository,
    ICommentRepository commentRepository,
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<ImportProjectBackupCommand, ImportBackupResult>
{
    public async Task<ImportBackupResult> Handle(ImportProjectBackupCommand request, CancellationToken ct)
    {
        var project = await projectRepository.GetByIdAsync(request.ProjectId, ct);
        if (project is null)
        {
            return new ImportBackupResult(0, 0, 0, 0, new[] { "Project not found." });
        }

        ExportData? backup;
        try
        {
            backup = System.Text.Json.JsonSerializer.Deserialize<ExportData>(
                request.JsonData,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            return new ImportBackupResult(0, 0, 0, 0, new[] { "Invalid JSON format." });
        }

        if (backup is null)
        {
            return new ImportBackupResult(0, 0, 0, 0, new[] { "Empty or invalid backup data." });
        }

        int importedTasks = 0, importedEpics = 0, importedSprints = 0, importedComments = 0;
        var errors = new List<string>();

        // ── 1. Remap Epic IDs ──
        var epicIdMap = new Dictionary<Guid, Guid>();
        foreach (var epicData in backup.Epics)
        {
            var newEpicId = Guid.NewGuid();
            epicIdMap[epicData.Id] = newEpicId;

            try
            {
                var epic = Domain.Entities.Epic.Create(
                    request.ProjectId,
                    epicData.Name,
                    epicData.Description,
                    epicData.StartDateUtc,
                    epicData.EndDateUtc);

                // Set the new ID by using reflection or a setter (BaseEntity has Id setter)
                EntityIdSetter.SetId(epic, newEpicId);

                await epicRepository.AddAsync(epic, ct);
                importedEpics++;
            }
            catch (Exception ex)
            {
                errors.Add($"Failed to import epic '{epicData.Name}': {ex.Message}");
            }
        }

        // ── 2. Remap Sprint IDs ──
        var sprintIdMap = new Dictionary<Guid, Guid>();
        foreach (var sprintData in backup.Sprints)
        {
            var newSprintId = Guid.NewGuid();
            sprintIdMap[sprintData.Id] = newSprintId;

            try
            {
                var sprint = Domain.Entities.Sprint.Create(
                    request.ProjectId,
                    sprintData.Name,
                    sprintData.Goal);
                EntityIdSetter.SetId(sprint, newSprintId);

                await sprintRepository.AddAsync(sprint, ct);
                importedSprints++;
            }
            catch (Exception ex)
            {
                errors.Add($"Failed to import sprint '{sprintData.Name}': {ex.Message}");
            }
        }

        // ── 3. Import Tasks (with remapped IDs) ──
        var taskIdMap = new Dictionary<Guid, Guid>();

        // First pass: create all tasks to get ID mapping
        foreach (var taskData in backup.Tasks)
        {
            var newTaskId = Guid.NewGuid();
            taskIdMap[taskData.Id] = newTaskId;

            try
            {
                if (!Enum.TryParse<TaskItemPriority>(taskData.Priority, true, out var priority))
                {
                    priority = TaskItemPriority.Medium;
                }

                var task = Domain.Entities.TaskItem.Create(
                    request.ProjectId,
                    taskData.Title,
                    taskData.Description,
                    priority);
                EntityIdSetter.SetId(task, newTaskId);

                // Apply status
                if (Enum.TryParse<TaskItemStatus>(taskData.Status, true, out var status)
                    && status != TaskItemStatus.Backlog)
                {
                    task.ChangeStatus(status);
                }

                // Remap references
                if (taskData.SprintId.HasValue && sprintIdMap.TryGetValue(taskData.SprintId.Value, out var newSprintId))
                {
                    task.AssignToSprint(newSprintId);
                }

                if (taskData.EpicId.HasValue && epicIdMap.TryGetValue(taskData.EpicId.Value, out var newEpicId))
                {
                    task.AttachToEpic(newEpicId);
                }

                if (taskData.AssigneeId.HasValue)
                {
                    task.AssignTo(taskData.AssigneeId);
                }

                if (taskData.StoryPoints.HasValue)
                {
                    task.SetStoryPoints(taskData.StoryPoints);
                }

                if (taskData.EstimateMinutes.HasValue)
                {
                    task.SetEstimate(taskData.EstimateMinutes);
                }

                task.Position = taskData.Position;

                await taskItemRepository.AddAsync(task, ct);
                importedTasks++;
            }
            catch (Exception ex)
            {
                errors.Add($"Failed to import task '{taskData.Title}': {ex.Message}");
            }
        }

        // Second pass: set parent task references (after all tasks exist)
        foreach (var taskData in backup.Tasks.Where(t => t.ParentTaskId.HasValue))
        {
            if (taskIdMap.TryGetValue(taskData.Id, out var newTaskId)
                && taskIdMap.TryGetValue(taskData.ParentTaskId!.Value, out var newParentId))
            {
                try
                {
                    var task = await taskItemRepository.GetByIdAsync(newTaskId, ct);
                    if (task is not null)
                    {
                        task.AttachToParent(newParentId);
                    }
                }
                catch (Exception ex)
                {
                    errors.Add($"Failed to link subtask for '{taskData.Title}': {ex.Message}");
                }
            }
        }

        // ── 4. Import Comments ──
        foreach (var commentData in backup.Comments)
        {
            // Only import comments whose parent task was imported
            if (!taskIdMap.TryGetValue(commentData.TaskItemId, out var newTaskIdForComment))
            {
                continue;
            }

            try
            {
                var comment = Domain.Entities.Comment.Create(
                    newTaskIdForComment,
                    commentData.AuthorId,
                    commentData.Content);
                EntityIdSetter.SetId(comment, Guid.NewGuid());

                await commentRepository.AddAsync(comment, ct);
                importedComments++;
            }
            catch (Exception ex)
            {
                errors.Add($"Failed to import comment: {ex.Message}");
            }
        }

        // Save all changes
        if (importedTasks + importedEpics + importedSprints + importedComments > 0)
        {
            await unitOfWork.SaveChangesAsync(ct);
        }

        return new ImportBackupResult(importedTasks, importedEpics, importedSprints, importedComments, errors);
    }
}

public sealed record ImportBackupResult(
    int TasksImported,
    int EpicsImported,
    int SprintsImported,
    int CommentsImported,
    IReadOnlyList<string> Errors);
