using DevFlow.Application.Common.Authorization;
using MediatR;

namespace DevFlow.Application.Features.Dashboard;

public sealed record DashboardResponse(
    int TotalTasks,
    Dictionary<string, int> TasksByStatus,
    Dictionary<string, int> TasksByPriority,
    IReadOnlyList<ActivityItem> RecentActivity,
    IReadOnlyList<DeadlineItem> UpcomingDeadlines);

public sealed record ActivityItem(
    string ActorName,
    string Verb,
    string Label,
    DateTimeOffset CreatedAtUtc);

public sealed record DeadlineItem(
    Guid TaskId,
    string Title,
    string ProjectKey,
    DateTimeOffset DueDateUtc,
    string Status);

public sealed record GetDashboardQuery(Guid WorkspaceId) : IRequest<DashboardResponse>, IWorkspaceRequest;
