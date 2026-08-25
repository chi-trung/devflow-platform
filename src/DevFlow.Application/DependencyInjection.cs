using DevFlow.Application.Common.Behaviors;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(options =>
        {
            options.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly);
            options.AddOpenBehavior(typeof(LoggingBehavior<,>));
            options.AddOpenBehavior(typeof(ValidationBehavior<,>));
            options.AddOpenBehavior(typeof(WorkspaceAuthorizationBehavior<,>));
            options.AddOpenBehavior(typeof(ProjectAuthorizationBehavior<,>));
            options.AddOpenBehavior(typeof(ActivityBehavior<,>));
            options.AddOpenBehavior(typeof(NotificationBehavior<,>));
            options.AddOpenBehavior(typeof(RealtimeBehavior<,>));
            options.AddOpenBehavior(typeof(CacheInvalidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        return services;
    }
}
