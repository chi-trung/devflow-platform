using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Comments.Create;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateCommentCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    string Content) : IRequest<CommentResponse>, IWorkspaceRequest, IProjectEvent
{
        public string ActivityVerb => "commented on task";
        public string ActivityLabel => Content.Length <= 40 ? Content : Content[..40] + "…";
        public Guid? ActivityTaskId => TaskId;
    }
