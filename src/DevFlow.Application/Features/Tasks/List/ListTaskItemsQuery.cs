using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.List;

public sealed record ListTaskItemsQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    TaskItemStatus? Status) : IRequest<IReadOnlyList<TaskItemResponse>>, IWorkspaceRequest;
