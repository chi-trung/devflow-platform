using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Activities;

public sealed class ListActivitiesQueryHandler(
    IActivityLogRepository activityLogRepository,
    IUserRepository userRepository)
    : IRequestHandler<ListActivitiesQuery, IReadOnlyList<ActivityResponse>>
{
    public async Task<IReadOnlyList<ActivityResponse>> Handle(
        ListActivitiesQuery query,
        CancellationToken cancellationToken)
    {
        var logs = await activityLogRepository.GetForProjectAsync(query.ProjectId, 50, cancellationToken);

        var actorIds = logs.Select(log => log.ActorUserId).Distinct().ToList();
        var names = await userRepository.GetDisplayNamesAsync(actorIds, cancellationToken);

        return logs
            .Select(log => new ActivityResponse(
                log.Id,
                log.TaskItemId,
                names.GetValueOrDefault(log.ActorUserId, "Someone"),
                log.Action,
                log.Target,
                log.CreatedAtUtc))
            .ToList();
    }
}
