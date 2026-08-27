using DevFlow.Application.Common.Behaviors;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.Create;

public sealed record CreateWorkspaceCommand(
    string Name,
    string Slug,
    string? Description) : IRequest<Guid>, IWorkspaceEvent
{
    /// <summary>Set by the handler once the workspace id is generated, so the
    /// realtime behavior can broadcast to the new workspace's group.</summary>
    public Guid WorkspaceId { get; set; }
}
