using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.TimeTracking;

// Get time entries for a task
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetTimeEntriesQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest<List<TimeEntryResponse>>, IWorkspaceRequest;

public class GetTimeEntriesHandler(
    ITimeEntryRepository timeEntryRepository,
    IUserRepository userRepository)
    : IRequestHandler<GetTimeEntriesQuery, List<TimeEntryResponse>>
{
    public async Task<List<TimeEntryResponse>> Handle(
        GetTimeEntriesQuery request,
        CancellationToken cancellationToken)
    {
        var entries = await timeEntryRepository.GetByTaskIdAsync(request.TaskId, cancellationToken);
        var result = new List<TimeEntryResponse>();

        foreach (var entry in entries)
        {
            var user = await userRepository.GetByIdAsync(entry.UserId, cancellationToken);
            result.Add(new TimeEntryResponse(
                entry.Id,
                entry.TaskId,
                entry.UserId,
                user?.Username ?? "Unknown",
                entry.Minutes,
                entry.Description,
                entry.DateUtc,
                entry.CreatedAtUtc));
        }

        return result;
    }
}

// Log time entry
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record LogTimeEntryCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    int Minutes,
    string? Description,
    DateTimeOffset DateUtc) : IRequest<Guid>, IWorkspaceRequest;

public class LogTimeEntryHandler(
    ITimeEntryRepository timeEntryRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork)
    : IRequestHandler<LogTimeEntryCommand, Guid>
{
    public async Task<Guid> Handle(
        LogTimeEntryCommand request,
        CancellationToken cancellationToken)
    {
        var task = await taskItemRepository.GetByIdAsync(request.TaskId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.TaskItem), request.TaskId);

        if (task.ProjectId != request.ProjectId)
            throw new NotFoundException(nameof(Domain.Entities.TaskItem), request.TaskId);

        var entry = Domain.Entities.TimeEntry.Create(
            request.TaskId,
            userContext.UserId,
            request.Minutes,
            request.Description,
            request.DateUtc);

        await timeEntryRepository.AddAsync(entry, cancellationToken);

        var log = Domain.Entities.ActivityLog.Create(
            request.WorkspaceId,
            request.ProjectId,
            request.TaskId,
            userContext.UserId,
            "logged time on",
            task.Title);
        await activityLog.AddAsync(log, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return entry.Id;
    }
}

// Delete time entry
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record DeleteTimeEntryCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    Guid EntryId) : IRequest, IWorkspaceRequest;

public class DeleteTimeEntryHandler(
    ITimeEntryRepository timeEntryRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork)
    : IRequestHandler<DeleteTimeEntryCommand>
{
    public async Task Handle(
        DeleteTimeEntryCommand request,
        CancellationToken cancellationToken)
    {
        var entry = await timeEntryRepository.GetByIdAsync(request.EntryId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.TimeEntry), request.EntryId);

        if (entry.TaskId != request.TaskId)
            throw new NotFoundException(nameof(Domain.Entities.TimeEntry), request.EntryId);

        var task = await taskItemRepository.GetByIdAsync(request.TaskId, cancellationToken);
        timeEntryRepository.Remove(entry);

        if (task is not null)
        {
            var log = Domain.Entities.ActivityLog.Create(
                request.WorkspaceId,
                request.ProjectId,
                request.TaskId,
                userContext.UserId,
                "removed time entry from",
                task.Title);
            await activityLog.AddAsync(log, cancellationToken);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
