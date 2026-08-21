using DevFlow.Application.Common.Authorization;
using MediatR;

namespace DevFlow.Application.Features.Sprints.List;

public sealed record ListSprintsQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<IReadOnlyList<SprintResponse>>, IWorkspaceRequest;
