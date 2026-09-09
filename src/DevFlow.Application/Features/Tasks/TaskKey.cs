namespace DevFlow.Application.Features.Tasks;

/// <summary>
/// Formats the human-readable task key shown in the UI and referenced by
/// GitHub commit/PR messages: "{Project.Key}-{Number}" (e.g. "DEV-42").
/// Computed at read time — only the numeric part is persisted on the task.
/// </summary>
public static class TaskKey
{
    public static string Format(string projectKey, int number) => $"{projectKey}-{number}";
}
