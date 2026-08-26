using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.Supersede;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record SupersedeKnowledgeEntryCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid EntryId,
    Guid SupersededByEntryId) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "superseded knowledge entry";
    public string ActivityLabel => string.Empty;
    public Guid? ActivityTaskId => null;
}
