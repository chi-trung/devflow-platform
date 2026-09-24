using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Ai.Suggest;

/// <summary>
/// Generates context-aware AI prompt suggestions based on real project data
/// and the page the user is viewing. Candidates are scored (urgency signals
/// first, then page-context boosts, then generic fillers), equal scores are
/// rotated on a time bucket so reopening the panel yields a different set, and
/// keys the user just picked are demoted unless that would starve the pool.
/// </summary>
public sealed class AiSuggestCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    IEpicRepository epicRepository,
    ITaskItemRepository taskItemRepository,
    ITaskDependencyRepository dependencyRepository,
    IWorkspaceRepository workspaceRepository,
    IUserContext userContext) : IRequestHandler<AiSuggestCommand, List<AiSuggestion>>
{
    /// <summary>Pool size returned to the client (UI shows 4; extras enable exclude + rotate).</summary>
    private const int MaxSuggestions = 6;

    /// <summary>Always return at least this many, even if every candidate was excluded.</summary>
    private const int MinSuggestions = 3;

    private sealed record Candidate(string Key, Dictionary<string, string>? Args, int Score);

    public async Task<List<AiSuggestion>> Handle(
        AiSuggestCommand command,
        CancellationToken cancellationToken)
    {
        var projects = await projectRepository.GetForWorkspaceAsync(command.WorkspaceId, cancellationToken);
        // create_sprint / create_project are Admin-gated on the nested command —
        // never offer those chips to a Member (Accept would 403).
        var role = await workspaceRepository.GetMemberRoleAsync(
            command.WorkspaceId,
            userContext.UserId,
            cancellationToken) ?? WorkspaceRole.Member;
        var canAdmin = role >= WorkspaceRole.Admin;

        if (projects.Count == 0)
        {
            var noProjectPool = NoProjectCandidates()
                .Where(c => canAdmin || c.Key != "ai.suggestCreateProject")
                .ToList();
            return Finalize(noProjectPool, command);
        }

        // Active project = the one the user is viewing, or the first one.
        var activeProject = projects.FirstOrDefault(p => p.Id == command.ProjectId) ?? projects[0];

        var sprints = await sprintRepository.GetForProjectAsync(activeProject.Id, cancellationToken);
        var epics = await epicRepository.GetForProjectAsync(activeProject.Id, cancellationToken);
        var tasks = await taskItemRepository.GetForProjectAsync(activeProject.Id, null, cancellationToken);
        var dependencies = await dependencyRepository.GetAllByProjectIdAsync(activeProject.Id, cancellationToken)
            ?? Array.Empty<DevFlow.Domain.Entities.TaskDependency>();

        var now = DateTimeOffset.UtcNow;
        var page = command.PageContext?.Trim().ToLowerInvariant();
        var candidates = new List<Candidate>();

        void Add(string key, Dictionary<string, string>? args, int score, string tag)
        {
            candidates.Add(new Candidate(key, args, score + ContextBoost(page, tag)));
        }

        // --- Urgency signals (tracked state, always ranked highest) ---
        var openTasks = tasks
            .Where(t => t.ParentTaskId is null && t.Status != TaskItemStatus.Done)
            .ToList();

        var overdue = openTasks.Count(t => t.DueDateUtc is not null && t.DueDateUtc < now);
        if (overdue > 0)
        {
            Add(
                "ai.suggestReviewOverdue",
                new() { ["count"] = overdue.ToString() },
                95,
                "overdue");
        }

        var dueSoon = openTasks.Count(t =>
            t.DueDateUtc is not null
            && t.DueDateUtc >= now
            && t.DueDateUtc <= now.AddDays(3));
        if (dueSoon > 0)
        {
            Add(
                "ai.suggestDueSoon",
                new() { ["count"] = dueSoon.ToString() },
                75,
                "due");
        }

        var taskById = tasks.ToDictionary(t => t.Id);
        var blockedCount = dependencies
            .Where(d => taskById.TryGetValue(d.BlockedTaskId, out var blocked) && blocked.Status != TaskItemStatus.Done)
            .Where(d =>
                !taskById.TryGetValue(d.BlockerTaskId, out var blocker)
                || blocker.Status != TaskItemStatus.Done)
            .Select(d => d.BlockedTaskId)
            .Distinct()
            .Count();
        if (blockedCount > 0)
        {
            Add(
                "ai.suggestUnblockTasks",
                new() { ["count"] = blockedCount.ToString() },
                85,
                "block");
        }

        // --- Sprint-based suggestions ---
        var currentSprint = sprints.FirstOrDefault(s => s.Status == SprintStatus.Active);
        var plannedSprints = sprints.Where(s => s.Status == SprintStatus.Planned).ToList();
        var completedSprints = sprints.Where(s => s.Status == SprintStatus.Completed).ToList();

        if (currentSprint is not null)
        {
            if (currentSprint.EndDateUtc is not null && currentSprint.EndDateUtc <= now.AddDays(3))
            {
                Add(
                    "ai.suggestWrapUpSprint",
                    new() { ["sprint"] = currentSprint.Name },
                    90,
                    "sprint");
            }

            Add(
                "ai.suggestAddTaskToSprint",
                new() { ["sprint"] = currentSprint.Name },
                70,
                "sprint");
        }
        else if (plannedSprints.Count > 0)
        {
            Add(
                "ai.suggestStartSprint",
                new() { ["sprint"] = plannedSprints[0].Name },
                70,
                "sprint");
        }
        else
        {
            // No active and no planned sprint — offer creating one so the
            // assistant is not only steered toward create_task / start-sprint.
            // Admin-only (CreateSprintCommand); Members would 403 on Accept.
            if (canAdmin)
                Add("ai.suggestCreateSprint", null, 45, "sprint");
        }

        if (completedSprints.Count > 0)
        {
            var lastCompleted = completedSprints[^1];
            var tasksInSprint = await taskItemRepository.GetForSprintAsync(lastCompleted.Id, cancellationToken);
            if (tasksInSprint.Any(t => t.Status != TaskItemStatus.Done))
            {
                Add("ai.suggestMoveUnfinishedTasks", null, 65, "sprint");
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
                Add(
                    "ai.suggestAddToEpic",
                    new() { ["epic"] = currentEpic.Name },
                    60,
                    "epic");
            }
        }
        else
        {
            Add("ai.suggestCreateEpic", null, 55, "epic");
        }

        // --- Task-based suggestions ---
        var unassignedTasks = openTasks.Where(t => t.AssigneeId is null).ToList();
        if (unassignedTasks.Count > 0)
        {
            Add(
                "ai.suggestAssignTasks",
                new() { ["count"] = unassignedTasks.Count.ToString() },
                50,
                "task");
        }

        var tasksWithoutSprint = openTasks.Where(t => t.SprintId is null).ToList();
        if (tasksWithoutSprint.Count > 0 && currentSprint is not null)
        {
            Add(
                "ai.suggestAssignToSprint",
                new()
                {
                    ["count"] = tasksWithoutSprint.Count.ToString(),
                    ["sprint"] = currentSprint.Name,
                },
                52,
                "sprint");
        }

        // --- Generic fillers (scored low so real state always wins, still in
        //     the pool so time-rotation and exclude-keys can surface them) ---
        Add("ai.suggestPlanMilestones", null, 25, "plan");
        Add("ai.suggestCreateTask", null, 20, "task");
        if (projects.Count <= 1 && canAdmin)
            Add("ai.suggestCreateProject", null, 18, "create");

        return Finalize(candidates, command);
    }

    /// <summary>
    /// Page-context bonus applied on top of the base score so the same project
    /// state yields different chips on board vs sprints vs dashboard.
    /// </summary>
    private static int ContextBoost(string? page, string tag) => page switch
    {
        "board" => tag is "sprint" or "task" or "overdue" or "due" or "block" ? 25 : 0,
        "sprints" => tag is "sprint" ? 30 : 0,
        "epics" => tag is "epic" ? 30 : 0,
        "dashboard" => tag is "plan" or "overdue" or "due" or "review" ? 20 : 0,
        "workspace" => tag is "create" or "task" ? 25 : 0,
        _ => 0,
    };

    /// <summary>
    /// Dedupes by key (highest score wins), demotes recently used keys, sorts
    /// by score with a time-bucket rotation among equals, then takes the pool.
    /// </summary>
    private static List<AiSuggestion> Finalize(List<Candidate> candidates, AiSuggestCommand command)
    {
        var excluded = command.ExcludeKeys is { Count: > 0 }
            ? new HashSet<string>(command.ExcludeKeys, StringComparer.Ordinal)
            : null;

        var best = candidates
            .GroupBy(c => c.Key, StringComparer.Ordinal)
            .Select(g => g.OrderByDescending(c => c.Score).First())
            .ToList();

        // Time bucket: 6-hour windows so equal-score sets reshuffle without
        // being random (deterministic within a window — stable for tests).
        var bucket = DateTimeOffset.UtcNow.Ticks / TimeSpan.FromHours(6).Ticks;
        var ordered = best
            .OrderByDescending(c => c.Score)
            .ThenBy(c => StableHash(c.Key, bucket))
            .ToList();

        // Prefer keys the user has not just picked. Demoted keys only re-enter
        // when the fresh pool would starve (fewer than MinSuggestions).
        var fresh = ordered
            .Where(c => excluded is null || !excluded.Contains(c.Key))
            .Take(MaxSuggestions)
            .ToList();
        var result = fresh.Count >= MinSuggestions
            ? fresh
            : ordered.Take(MaxSuggestions).ToList();

        return result
            .Select(c => new AiSuggestion(c.Key, c.Args))
            .ToList();
    }

    private static long StableHash(string key, long bucket)
    {
        // FNV-1a mixed with the time bucket — rotates equal-score keys per window.
        unchecked
        {
            ulong hash = 14695981039346656037UL;
            var material = $"{key}:{bucket}";
            foreach (var ch in material)
            {
                hash ^= ch;
                hash *= 1099511628211UL;
            }
            return (long)hash;
        }
    }

    private static List<Candidate> NoProjectCandidates() =>
    [
        new("ai.suggestCreateProject", null, 50),
        new("ai.suggestCreateTask", null, 40),
        new("ai.suggestPlanMilestones", null, 30),
    ];
}
