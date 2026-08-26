using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Milestones.List;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListMilestonesQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<IReadOnlyList<MilestoneResponse>>, IWorkspaceRequest;
