using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.GitHub.CreateTaskPullRequest;

/// <summary>
/// Creates a Git branch with a starter commit and opens a pull request in the
/// project's linked GitHub repository, authenticated with the caller's stored
/// GitHub OAuth token. The PR title starts with the task key so the webhook
/// auto-linker (and the stored LinkedTaskId) bind it to the task.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateTaskPullRequestCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    string? BranchName = null)
    : IRequest<PullRequestResponse>, IWorkspaceRequest, IProjectEvent
{
    public Guid? ActivityTaskId => TaskId;

    public string ActivityVerb => "opened pull request";

    public string ActivityLabel { get; set; } = "";
}
