using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Infrastructure.Authentication;
using DevFlow.Infrastructure.Caching;
using DevFlow.Infrastructure.Outbox;
using DevFlow.Infrastructure.Persistence;
using DevFlow.Infrastructure.Persistence.Interceptors;
using DevFlow.Infrastructure.Persistence.Repositories;
using DevFlow.Infrastructure.Email;
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
        services.Configure<OAuthSettings>(configuration.GetSection(OAuthSettings.SectionName));

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
        services.AddScoped<IEpicRepository, EpicRepository>();
        services.AddScoped<IActivityLogRepository, ActivityLogRepository>();
        services.AddScoped<ITaskAttachmentRepository, TaskAttachmentRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<ILabelRepository, LabelRepository>();
        services.AddScoped<ITaskDependencyRepository, TaskDependencyRepository>();
        services.AddScoped<ITimeEntryRepository, TimeEntryRepository>();
        services.AddScoped<IReportingRepository, ReportingRepository>();
        services.AddScoped<IGitHubRepository, GitHubRepository>();
        services.AddScoped<ITemplateRepository, TemplateRepository>();
        services.AddScoped<ICustomFieldRepository, CustomFieldRepository>();
        services.AddScoped<IWebhookRepository, WebhookRepository>();
        services.AddScoped<ITaskWatcherRepository, TaskWatcherRepository>();
        services.AddScoped<INotificationPreferencesRepository, NotificationPreferencesRepository>();
        services.AddScoped<IPersonalAccessTokenRepository, PersonalAccessTokenRepository>();
        services.AddScoped<ISocialLoginRepository, SocialLoginRepository>();
        services.AddScoped<IWebhookDispatcher, WebhookDispatcher>();
        services.AddScoped<IOutboxRepository, OutboxRepository>();
        services.AddScoped<IOutboxDispatcher, OutboxDispatcher>();
        services.AddHostedService<OutboxProcessor>();
        services.AddHttpClient("Webhooks");
        if (!string.IsNullOrWhiteSpace(configuration["RESEND_API_KEY"]))
        {
            services.AddHttpClient<IEmailService, ResendEmailService>();
        }
        else
        {
            services.AddScoped<IEmailService, NoOpEmailService>();
        }
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddScoped<ITokenProvider, JwtTokenProvider>();
        services.AddScoped<IExternalIdentityProvider, GoogleIdentityProvider>();
        services.AddHttpClient("OAuth");

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
