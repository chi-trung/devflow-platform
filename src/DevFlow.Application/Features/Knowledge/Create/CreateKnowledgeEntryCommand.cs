using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.Create;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateKnowledgeEntryCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Title,
    string? Body,
    KnowledgeType Type,
    string? Tags) : IRequest<KnowledgeEntryCreatedResponse>, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "created knowledge entry";
    public string ActivityLabel => Title;
    public Guid? ActivityTaskId => null;
}

public sealed record KnowledgeEntryCreatedResponse(Guid Id);
