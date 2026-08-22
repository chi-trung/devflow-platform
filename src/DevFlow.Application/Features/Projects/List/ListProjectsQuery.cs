using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Models;
using MediatR;

namespace DevFlow.Application.Features.Projects.List;

public sealed record ListProjectsQuery(
    Guid WorkspaceId,
    int Page = 1,
    int PageSize = 20) : IRequest<PagedResult<ProjectResponse>>, IWorkspaceRequest;
