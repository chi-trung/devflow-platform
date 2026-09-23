using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Get;

/// <summary>
/// Fetches a single task by id for the full-page task detail route. Unlike
/// the list endpoint there is no status/page context — the caller already
/// knows the task id from the URL.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetTaskByIdQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest<TaskItemResponse>, IWorkspaceRequest;

public sealed class GetTaskByIdQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ITaskAttachmentRepository taskAttachmentRepository,
    IGitHubRepository gitHubRepository,
    ILabelRepository labelRepository) : IRequestHandler<GetTaskByIdQuery, TaskItemResponse>
{
    public async Task<TaskItemResponse> Handle(
        GetTaskByIdQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var task = await taskItemRepository.GetByIdAsync(query.TaskId, cancellationToken);

        if (task is null || task.ProjectId != query.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), query.TaskId);
        }

        // Same enrichment as the list handler, scoped to this one task.
        var attachments = await taskAttachmentRepository.GetByTaskIdsAsync(
            [task.Id], cancellationToken);

        var pullRequests = (await gitHubRepository.GetPullRequestsByProjectAsync(
                query.ProjectId, cancellationToken))
            .Where(pr => pr.LinkedTaskId == task.Id)
            .ToList();

        var labelIdsByTask = await labelRepository.GetLabelIdsByTaskIdsAsync(
            query.ProjectId,
            [task.Id],
            cancellationToken);

        return new TaskItemResponse(
            task.Id,
            task.ProjectId,
            TaskKey.Format(project.Key, task.Number),
            task.Number,
            task.Title,
            task.Description,
            task.DefinitionOfDone,
            task.Status.ToString(),
            task.Priority.ToString(),
            task.AssigneeId,
            task.SprintId,
            task.EpicId,
            task.ParentTaskId,
            task.StoryPoints,
            task.DueDateUtc,
            task.CompletedAtUtc,
            task.Position,
            TaskSummaries.BuildAttachmentSummary(attachments.GetValueOrDefault(task.Id)),
            TaskSummaries.BuildPullRequestSummary(pullRequests),
            EnteredReviewAtUtc: task.EnteredReviewAtUtc,
            LabelIds: labelIdsByTask.GetValueOrDefault(task.Id));
    }
}
