using DevFlow.Application.Common.Models;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.List;

public sealed record WorkspaceResponse(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string Role);

public sealed record ListWorkspacesQuery(
    int Page = 1,
    int PageSize = 20) : IRequest<PagedResult<WorkspaceResponse>>;
