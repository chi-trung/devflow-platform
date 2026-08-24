using DevFlow.Domain.Enums;

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
    int TotalMinutesLogged,
    int InProgressCount,
    double? AvgCycleTimeDays);

public sealed record TeamReportTrends(
    int CompletedDelta,
    double? CycleTimeDelta);

public sealed record TeamReportResponse(
    List<TeamMemberStats> Members,
    int TotalTasks,
    int TotalCompleted,
    int TotalMinutesLogged,
    TeamReportTrends Trends);

public sealed record TaskCycleLeadTime(
    Guid TaskId,
    string Title,
    TaskItemStatus Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? StartedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    double? CycleTimeDays,
    double? LeadTimeDays);

public sealed record CycleLeadTimeResponse(
    double? CycleTimeP50,
    double? CycleTimeP90,
    double? LeadTimeP50,
    double? LeadTimeP90,
    IReadOnlyList<TaskCycleLeadTime> Tasks);

public sealed record VelocityHistoryPoint(
    Guid SprintId,
    string SprintName,
    int TotalStoryPoints,
    int CompletedStoryPoints,
    DateTimeOffset? EndDateUtc);

public sealed record VelocityHistoryResponse(
    IReadOnlyList<VelocityHistoryPoint> Points,
    double AverageCompleted,
    double AverageTotal);
