using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Epics.List;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListEpicsQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<IReadOnlyList<EpicResponse>>, IWorkspaceRequest;
