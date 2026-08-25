using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Epics.Dependencies;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListEpicDependenciesQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid EpicId) : IRequest<IReadOnlyList<EpicDependencyResponse>>, IWorkspaceRequest;

public sealed record EpicDependencyResponse(Guid EpicId, Guid BlockedByEpicId);

public sealed class ListEpicDependenciesQueryHandler(
    IEpicRepository epicRepository,
    IEpicDependencyRepository dependencyRepository) : IRequestHandler<ListEpicDependenciesQuery, IReadOnlyList<EpicDependencyResponse>>
{
    public async Task<IReadOnlyList<EpicDependencyResponse>> Handle(
        ListEpicDependenciesQuery query,
        CancellationToken cancellationToken)
    {
        var epic = await epicRepository.GetByIdAsync(query.EpicId, cancellationToken);
        if (epic is null || epic.ProjectId != query.ProjectId)
        {
            throw new NotFoundException(nameof(Epic), query.EpicId);
        }

        var dependencies = await dependencyRepository.GetForEpicAsync(query.EpicId, cancellationToken);

        return dependencies
            .Select(d => new EpicDependencyResponse(d.EpicId, d.BlockedById))
            .ToList();
    }
}