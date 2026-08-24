using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Activities;

public sealed class ListActivitiesQueryHandler(
    IActivityLogRepository activityLogRepository,
    IUserRepository userRepository)
    : IRequestHandler<ListActivitiesQuery, ActivityResponsePage>
{
    public async Task<ActivityResponsePage> Handle(
        ListActivitiesQuery query,
        CancellationToken cancellationToken)
    {
        var pageSize = Math.Clamp(query.Take, 1, 200);
        var page = Math.Max(query.Page, 1);
        var skip = (page - 1) * pageSize;

        var result = await activityLogRepository.GetFilteredAsync(
            query.ProjectId,
            query.ActorUserId,
            query.TaskItemId,
            query.Action,
            query.FromUtc,
            query.ToUtc,
            skip,
            pageSize,
            cancellationToken);

        var actorIds = result.Items.Select(log => log.ActorUserId).Distinct().ToList();
        var names = await userRepository.GetDisplayNamesAsync(actorIds, cancellationToken);

        var items = result.Items
            .Select(log => new ActivityResponse(
                log.Id,
                log.TaskItemId,
                names.GetValueOrDefault(log.ActorUserId, "Someone"),
                log.Action,
                log.Target,
                log.CreatedAtUtc))
            .ToList();

        var totalPages = (int)Math.Ceiling((double)result.TotalCount / pageSize);

        return new ActivityResponsePage(
            items,
            result.TotalCount,
            page,
            pageSize);
    }
}
