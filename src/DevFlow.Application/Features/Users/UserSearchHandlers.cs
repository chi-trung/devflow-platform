using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Users;

// Search users in workspace for @mention autocomplete
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record SearchUsersQuery(
    Guid WorkspaceId,
    string Query) : IRequest<List<UserSearchResponse>>, IWorkspaceRequest;

public class SearchUsersHandler(
    IWorkspaceRepository workspaceRepository)
    : IRequestHandler<SearchUsersQuery, List<UserSearchResponse>>
{
    public async Task<List<UserSearchResponse>> Handle(SearchUsersQuery request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Query) || request.Query.Length < 2)
            return [];

        var members = await workspaceRepository.GetMembersAsync(request.WorkspaceId, ct);
        var query = request.Query.Trim().ToLower();

        return members
            .Where(m => m.Username.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                        m.DisplayName.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                        m.Email.Contains(query, StringComparison.OrdinalIgnoreCase))
            .Take(10)
            .Select(m => new UserSearchResponse(m.UserId, m.Username, m.DisplayName, m.Email, m.Role.ToString()))
            .ToList();
    }
}

public sealed record UserSearchResponse(Guid Id, string Username, string DisplayName, string Email, string Role);
