using DevFlow.Application.Common.Interfaces;
using DevFlow.Infrastructure.Authentication;
using DevFlow.Infrastructure.Caching;
using DevFlow.Infrastructure.Persistence;
using DevFlow.Infrastructure.Persistence.Interceptors;
using DevFlow.Infrastructure.Persistence.Repositories;
using DevFlow.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));

        services.AddSingleton<AuditableEntityInterceptor>();

        services.AddDbContext<DevFlowDbContext>((sp, options) =>
        {
            options
                .UseNpgsql(configuration.GetConnectionString("Database"))
                .UseSnakeCaseNamingConvention()
                .AddInterceptors(sp.GetRequiredService<AuditableEntityInterceptor>());
        });

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IWorkspaceRepository, WorkspaceRepository>();
        services.AddScoped<IProjectRepository, ProjectRepository>();
        services.AddScoped<ITaskItemRepository, TaskItemRepository>();
        services.AddScoped<ICommentRepository, CommentRepository>();
        services.AddScoped<ISprintRepository, SprintRepository>();
        services.AddScoped<IActivityLogRepository, ActivityLogRepository>();
        services.AddScoped<ITaskAttachmentRepository, TaskAttachmentRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<ILabelRepository, LabelRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddScoped<ITokenProvider, JwtTokenProvider>();

        var redisConnection = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrWhiteSpace(redisConnection))
        {
            try
            {
                var multiplexer = StackExchange.Redis.ConnectionMultiplexer.Connect(redisConnection);
                services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(multiplexer);
                services.AddSingleton<ICacheService, RedisCacheService>();
            }
            catch
            {
                services.AddSingleton<ICacheService, NullCacheService>();
            }
        }
        else
        {
            services.AddSingleton<ICacheService, NullCacheService>();
        }

        return services;
    }
}
