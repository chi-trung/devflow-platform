using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// Enforces workspace membership and the minimum role declared on
/// <see cref="IWorkspaceRequest"/> implementations before the handler runs.
/// </summary>
public sealed class WorkspaceAuthorizationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IWorkspaceRepository _workspaceRepository;
    private readonly IUserContext _userContext;

    public WorkspaceAuthorizationBehavior(
        IWorkspaceRepository workspaceRepository,
        IUserContext userContext)
    {
        _workspaceRepository = workspaceRepository;
        _userContext = userContext;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request is IWorkspaceRequest workspaceRequest)
        {
            var requiredRole = request.GetType()
                .GetCustomAttributes(typeof(RequireWorkspaceRoleAttribute), inherit: false)
                .Cast<RequireWorkspaceRoleAttribute>()
                .FirstOrDefault()?.MinimumRole
                ?? Domain.Enums.WorkspaceRole.Member;

            var currentRole = await _workspaceRepository.GetMemberRoleAsync(
                workspaceRequest.WorkspaceId,
                _userContext.UserId,
                cancellationToken);

            if (currentRole is null || currentRole.Value < requiredRole)
            {
                throw new ForbiddenAccessException();
            }
        }

        return await next();
    }
}
