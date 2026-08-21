using DevFlow.Application.Common.Authorization;
using MediatR;

namespace DevFlow.Application.Features.Projects.List;

public sealed record ListProjectsQuery(Guid WorkspaceId)
    : IRequest<IReadOnlyList<ProjectResponse>>, IWorkspaceRequest;
