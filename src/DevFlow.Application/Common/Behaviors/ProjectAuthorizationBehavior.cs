using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// Enforces project-level role checks for <see cref="IProjectRequest"/>
/// implementations that carry <see cref="RequireProjectRoleAttribute"/>.
/// A user who is an explicit project member must meet the minimum project role.
/// A user who is NOT a project member falls through to the workspace check
/// (Owner/Admin/Member still authorized by workspace membership).
/// </summary>
public sealed class ProjectAuthorizationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IProjectMemberRepository _projectMemberRepository;
    private readonly IUserContext _userContext;

    public ProjectAuthorizationBehavior(
        IProjectMemberRepository projectMemberRepository,
        IUserContext userContext)
    {
        _projectMemberRepository = projectMemberRepository;
        _userContext = userContext;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request is IProjectRequest projectRequest)
        {
            var requiredRole = request.GetType()
                .GetCustomAttributes(typeof(RequireProjectRoleAttribute), inherit: false)
                .Cast<RequireProjectRoleAttribute>()
                .FirstOrDefault()?.MinimumRole;

            if (requiredRole is not null)
            {
                var projectRole = await _projectMemberRepository.GetRoleAsync(
                    projectRequest.ProjectId,
                    _userContext.UserId,
                    cancellationToken);

                // Project members must meet the minimum role. Non-members fall
                // through to the workspace authorization behavior.
                if (projectRole is not null && projectRole.Value < requiredRole)
                {
                    throw new ForbiddenAccessException();
                }
            }
        }

        return await next();
    }
}
