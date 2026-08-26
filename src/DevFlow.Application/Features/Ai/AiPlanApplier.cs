using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;

namespace DevFlow.Application.Features.Ai;

/// <summary>
/// Shared application logic for turning a parsed AI plan into real subtasks and
/// a Definition of Done. Used both by the self-approval path (Project
/// ApproveAiPlans = true) and the manual Apply endpoint.
/// </summary>
public sealed class AiPlanApplier(
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork)
{
    public async Task ApplyAsync(
        Project project,
        TaskItem task,
        AiPlan plan,
        AiPlanContract contract,
        CancellationToken cancellationToken)
    {
        var existingSubtasks = await taskItemRepository.GetSubtasksAsync(task.Id, cancellationToken);
        var existingTitles = new HashSet<string>(
            existingSubtasks.Select(s => s.Title.Trim().ToLowerInvariant()),
            StringComparer.OrdinalIgnoreCase);

        foreach (var subtaskContract in contract.Subtasks)
        {
            var title = subtaskContract.Title?.Trim();

            if (string.IsNullOrWhiteSpace(title) || existingTitles.Contains(title.ToLowerInvariant()))
            {
                continue;
            }

            var priority = Enum.TryParse<Domain.Enums.TaskItemPriority>(
                subtaskContract.Priority,
                ignoreCase: true,
                out var parsed)
                ? parsed
                : Domain.Enums.TaskItemPriority.Medium;

            var subtask = TaskItem.Create(project.Id, title, subtaskContract.Description, priority);
            subtask.AttachToParent(task.Id);

            if (task.SprintId is not null)
            {
                subtask.AssignToSprint(task.SprintId.Value);
            }

            if (task.EpicId is not null)
            {
                subtask.AttachToEpic(task.EpicId);
            }

            if (task.AssigneeId is not null)
            {
                subtask.AssignTo(task.AssigneeId);
            }

            existingTitles.Add(title.ToLowerInvariant());
            await taskItemRepository.AddAsync(subtask, cancellationToken);
        }

        var doD = string.Join(Environment.NewLine, contract.DefinitionOfDone
            .Select(d => d.Trim())
            .Where(d => !string.IsNullOrWhiteSpace(d)));

        if (!string.IsNullOrWhiteSpace(doD))
        {
            task.SetDefinitionOfDone(doD);
        }

        plan.MarkApplied();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
