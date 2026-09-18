using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Projects.Stats;

/// <summary>
/// Batched replacement for the workspace page's per-project /tasks fan-out,
/// which issued one request per project purely to count tasks. The project list
/// and the task counts must stay in the same scope: only projects the caller can
/// see contribute, so the task query is scoped to those project ids and no other
/// workspace's tasks can leak into the counts.
/// </summary>
public sealed class ProjectTaskStatsQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository)
    : IRequestHandler<ProjectTaskStatsQuery, IReadOnlyList<ProjectTaskStatsResponse>>
{
    public async Task<IReadOnlyList<ProjectTaskStatsResponse>> Handle(
        ProjectTaskStatsQuery query,
        CancellationToken cancellationToken)
    {
        // Same set ListProjectsQuery sees: the repository applies the
        // soft-delete filter, so archived projects are absent here too.
        var projects = await projectRepository.GetForWorkspaceAsync(
            query.WorkspaceId, cancellationToken);

        var projectIds = projects.Select(p => p.Id).ToList();

        // ONE query for every task across every project (status is null: the
        // counts need every status, not a filtered page).
        var tasks = await taskItemRepository.GetForProjectsAsync(
            projectIds, status: null, cancellationToken);

        // Keyed off the project list, not the task groups: a project with no
        // tasks still gets a row (0/0), which is a known-empty project. The
        // frontend renders a missing row as "unknown", which is right for a
        // failed fetch and wrong for an empty one.
        var byProject = tasks.ToLookup(t => t.ProjectId);

        return projects
            .Select(p =>
            {
                var rows = byProject[p.Id];
                return new ProjectTaskStatsResponse(
                    p.Id,
                    rows.Count(),
                    rows.Count(t => t.Status == TaskItemStatus.Done));
            })
            .ToList();
    }
}
