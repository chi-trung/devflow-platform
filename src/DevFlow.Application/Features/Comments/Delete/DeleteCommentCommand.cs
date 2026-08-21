using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Comments.Delete;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record DeleteCommentCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    Guid CommentId) : IRequest, IWorkspaceRequest, IProjectEvent;
