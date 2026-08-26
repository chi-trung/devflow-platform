using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.Update;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record UpdateKnowledgeEntryCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid EntryId,
    string Title,
    string? Body,
    KnowledgeType Type,
    string? Tags,
    KnowledgeStatus Status) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "updated knowledge entry";
    public string ActivityLabel => Title;
    public Guid? ActivityTaskId => null;
}
