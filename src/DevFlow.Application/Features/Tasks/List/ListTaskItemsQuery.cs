using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Models;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.List;

public sealed record ListTaskItemsQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    TaskItemStatus? Status,
    int Page = 1,
    int PageSize = 20) : IRequest<PagedResult<TaskItemResponse>>, IWorkspaceRequest;
