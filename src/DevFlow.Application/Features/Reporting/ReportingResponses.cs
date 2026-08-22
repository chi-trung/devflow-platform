namespace DevFlow.Application.Features.Reporting;

public sealed record BurndownPoint(
    DateOnly Date,
    int RemainingTasks,
    int IdealRemaining);

public sealed record BurndownResponse(
    DateOnly StartDate,
    DateOnly EndDate,
    int TotalTasks,
    List<BurndownPoint> Points);

public sealed record SprintVelocity(
    Guid SprintId,
    string SprintName,
    int CompletedTasks,
    int TotalTasks,
    double CompletionRate);

public sealed record VelocityResponse(
    List<SprintVelocity> Sprints,
    double AverageCompletionRate);

public sealed record TeamMemberStats(
    Guid UserId,
    string UserName,
    int TasksAssigned,
    int TasksCompleted,
    int TotalMinutesLogged);

public sealed record TeamReportResponse(
    List<TeamMemberStats> Members,
    int TotalTasks,
    int TotalCompleted,
    int TotalMinutesLogged);
