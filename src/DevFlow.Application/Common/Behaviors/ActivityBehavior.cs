using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// After a project-scoped command succeeds, records an activity-log entry
/// describing what changed. Logging failures never fail the command itself.
/// </summary>
public sealed class ActivityBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IActivityLogRepository activityLogRepository;
    private readonly IUserContext userContext;
    private readonly IUnitOfWork unitOfWork;
    private readonly ILogger<ActivityBehavior<TRequest, TResponse>> logger;

    public ActivityBehavior(
        IActivityLogRepository activityLogRepository,
        IUserContext userContext,
        IUnitOfWork unitOfWork,
        ILogger<ActivityBehavior<TRequest, TResponse>> logger)
    {
        this.activityLogRepository = activityLogRepository;
        this.userContext = userContext;
        this.unitOfWork = unitOfWork;
        this.logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var response = await next();

        if (request is IProjectEvent projectEvent &&
            !string.IsNullOrWhiteSpace(projectEvent.ActivityVerb))
        {
            try
            {
                // A handler that loaded the entity knows its title; a command
                // that only carries an id cannot. Prefer the resolved label so
                // the feed never shows a bare GUID where a task name belongs.
                var label = request is IActivityLabelSink sink && sink.ResolvedActivityLabel is { Length: > 0 } resolved
                    ? resolved
                    : projectEvent.ActivityLabel;

                var entry = Domain.Entities.ActivityLog.Create(
                    GetWorkspaceId(request),
                    projectEvent.ProjectId,
                    projectEvent.ActivityTaskId,
                    userContext.UserId,
                    projectEvent.ActivityVerb,
                    label);

                await activityLogRepository.AddAsync(entry, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "Failed to record activity for {RequestType}",
                    typeof(TRequest).Name);
            }
        }

        return response;
    }

    private static Guid GetWorkspaceId(TRequest request) =>
        request is IWorkspaceRequest workspaceRequest
            ? workspaceRequest.WorkspaceId
            : Guid.Empty;
}
