using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Comments.List;

public sealed record ListCommentsQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest<IReadOnlyList<CommentResponse>>, IWorkspaceRequest;
