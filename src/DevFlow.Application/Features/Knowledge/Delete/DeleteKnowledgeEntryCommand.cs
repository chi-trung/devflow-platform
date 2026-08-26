using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.Delete;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record DeleteKnowledgeEntryCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid EntryId) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "deleted knowledge entry";
    public string ActivityLabel => string.Empty;
    public Guid? ActivityTaskId => null;
}
