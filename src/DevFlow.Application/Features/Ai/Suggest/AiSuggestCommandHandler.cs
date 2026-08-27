using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Ai.Suggest;

/// <summary>
/// Generates context-aware AI prompt suggestions based on real project data.
/// Reads the current project's sprints, epics, and tasks, and returns i18n keys
/// + interpolation params so the frontend renders suggestions in the user's
/// language. Falls back to generic suggestions when there is no data.
/// </summary>
public sealed class AiSuggestCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    IEpicRepository epicRepository,
    ITaskItemRepository taskItemRepository) : IRequestHandler<AiSuggestCommand, List<AiSuggestion>>
{
    public async Task<List<AiSuggestion>> Handle(
        AiSuggestCommand command,
        CancellationToken cancellationToken)
    {
        var projects = await projectRepository.GetForWorkspaceAsync(command.WorkspaceId, cancellationToken);

        if (projects.Count == 0)
            return NoProjectSuggestions();

        // Active project = the one the user is viewing, or the first one.
        var activeProject = projects.FirstOrDefault(p => p.Id == command.ProjectId) ?? projects[0];

        var sprints = await sprintRepository.GetForProjectAsync(activeProject.Id, cancellationToken);
        var epics = await epicRepository.GetForProjectAsync(activeProject.Id, cancellationToken);
        var tasks = await taskItemRepository.GetForProjectAsync(activeProject.Id, null, cancellationToken);

        var suggestions = new List<AiSuggestion>();

        // --- Sprint-based suggestions ---
        var currentSprint = sprints.FirstOrDefault(s => s.Status == SprintStatus.Active);
        var plannedSprints = sprints.Where(s => s.Status == SprintStatus.Planned).ToList();
        var completedSprints = sprints.Where(s => s.Status == SprintStatus.Completed).ToList();

        if (currentSprint is not null)
        {
            // "Add tasks to the current sprint"
            suggestions.Add(new AiSuggestion(
                "ai.suggestAddTaskToSprint",
                new() { ["sprint"] = currentSprint.Name }));
        }
        else if (plannedSprints.Count > 0)
        {
            // "Start sprint \"{plannedSprint.name}\""
            suggestions.Add(new AiSuggestion(
                "ai.suggestStartSprint",
                new() { ["sprint"] = plannedSprints[0].Name }));
        }

        // If there are completed sprints, suggest moving unfinished tasks
        if (completedSprints.Count > 0)
        {
            var lastCompleted = completedSprints[^1];
            var tasksInSprint = await taskItemRepository.GetForSprintAsync(lastCompleted.Id, cancellationToken);
            if (tasksInSprint.Any(t => t.Status != TaskItemStatus.Done))
            {
                suggestions.Add(new AiSuggestion("ai.suggestMoveUnfinishedTasks"));
            }
        }

        // --- Epic-based suggestions ---
        var tasksWithoutEpic = tasks.Where(t => t.ParentTaskId is null && t.EpicId is null).ToList();
        if (epics.Count > 0)
        {
            var currentEpic = command.EpicId.HasValue
                ? epics.FirstOrDefault(e => e.Id == command.EpicId.Value)
                : null;
            if (currentEpic is not null && tasksWithoutEpic.Count > 0)
            {
                // "Add tasks to epic \"{epic}\""
                suggestions.Add(new AiSuggestion(
                    "ai.suggestAddToEpic",
                    new() { ["epic"] = currentEpic.Name }));
            }
        }
        else
        {
            suggestions.Add(new AiSuggestion("ai.suggestCreateEpic"));
        }

        // --- Task-based suggestions ---
        var unassignedTasks = tasks.Where(t => t.AssigneeId is null && t.ParentTaskId is null).ToList();
        if (unassignedTasks.Count > 0)
        {
            suggestions.Add(new AiSuggestion(
                "ai.suggestAssignTasks",
                new() { ["count"] = unassignedTasks.Count.ToString() }));
        }

        // Tasks with no sprint
        var tasksWithoutSprint = tasks.Where(t => t.ParentTaskId is null && t.SprintId is null).ToList();
        if (tasksWithoutSprint.Count > 0 && currentSprint is not null)
        {
            suggestions.Add(new AiSuggestion(
                "ai.suggestAssignToSprint",
                new() { ["count"] = tasksWithoutSprint.Count.ToString(), ["sprint"] = currentSprint.Name }));
        }

        // --- Generic suggestions as fillers ---
        if (suggestions.Count < 3)
        {
            suggestions.Add(new AiSuggestion("ai.suggestPlanMilestones"));
        }

        if (suggestions.Count < 3)
        {
            suggestions.Add(new AiSuggestion("ai.suggestCreateTask"));
        }

        // If we still have room, fill with more generic ones
        if (suggestions.Count < 3 && projects.Count <= 1)
        {
            suggestions.Add(new AiSuggestion("ai.suggestCreateProject"));
        }

        // Take at most 4 so the layout doesn't get cluttered
        return suggestions.Take(4).ToList();
    }

    private static List<AiSuggestion> NoProjectSuggestions() => new()
    {
        new("ai.suggestCreateProject"),
        new("ai.suggestCreateTask"),
        new("ai.suggestPlanMilestones"),
    };
}