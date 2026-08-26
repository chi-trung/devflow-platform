using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.List;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListKnowledgeEntriesQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<IReadOnlyList<KnowledgeEntryResponse>>, IWorkspaceRequest;
