namespace DevFlow.Application.Features.Activities;

/// <summary>
/// Known activity verb strings used across all command handlers.
/// </summary>
public static class ActivityAction
{
    public const string CreatedTask = "created task";
    public const string UpdatedTask = "updated task";
    public const string DeletedTask = "deleted task";
    public const string CommentedOnTask = "commented on task";
    public const string RemovedComment = "removed comment from task";
    public const string CreatedSubtask = "created subtask";
    public const string DetachedSubtask = "detached subtask";
    public const string CreatedEpic = "created epic";
    public const string UpdatedEpic = "updated epic";
    public const string DeletedEpic = "deleted epic";
    public const string AttachedFile = "attached file";
    public const string RemovedAttachment = "removed attachment";
    public const string EstimatedTask = "estimated task";
    public const string StartedSprint = "started sprint";
    public const string CompletedSprint = "completed sprint";
    public const string CreatedSprint = "created sprint";
    public const string ScheduledTaskIntoSprint = "scheduled task into sprint";
    public const string PulledTaskBackToBacklog = "pulled task back to backlog";

    public static readonly IReadOnlyList<string> All =
    [
        CreatedTask,
        UpdatedTask,
        DeletedTask,
        CommentedOnTask,
        RemovedComment,
        CreatedSubtask,
        DetachedSubtask,
        CreatedEpic,
        UpdatedEpic,
        DeletedEpic,
        AttachedFile,
        RemovedAttachment,
        EstimatedTask,
        StartedSprint,
        CompletedSprint,
        CreatedSprint,
        ScheduledTaskIntoSprint,
        PulledTaskBackToBacklog
    ];
}
