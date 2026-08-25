using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Attachments;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListTaskAttachmentsQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    int Page = 1,
    int PageSize = 10) : IRequest<PagedResult<TaskAttachmentResponse>>, IWorkspaceRequest;

public sealed class ListTaskAttachmentsQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ITaskAttachmentRepository taskAttachmentRepository)
    : IRequestHandler<ListTaskAttachmentsQuery, PagedResult<TaskAttachmentResponse>>
{
    public async Task<PagedResult<TaskAttachmentResponse>> Handle(
        ListTaskAttachmentsQuery query,
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

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 50);
        var skip = (page - 1) * pageSize;

        var (attachments, totalCount) = await taskAttachmentRepository.GetForTaskPagedAsync(
            query.TaskId, skip, pageSize, cancellationToken);

        var items = attachments
            .Select(att => new TaskAttachmentResponse(
                att.Id,
                att.TaskItemId,
                att.FileName,
                att.ContentType,
                att.FileSize,
                att.CreatedAtUtc))
            .ToList();

        return new PagedResult<TaskAttachmentResponse>(items, totalCount, page, pageSize);
    }
}