using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Infrastructure.AI;
using DevFlow.Infrastructure.Authentication;
using DevFlow.Infrastructure.GitHub;
using DevFlow.Infrastructure.Caching;
using DevFlow.Infrastructure.Outbox;
using DevFlow.Infrastructure.Persistence;
using DevFlow.Infrastructure.Recurring;
using DevFlow.Infrastructure.Persistence.Interceptors;
using DevFlow.Infrastructure.Persistence.Repositories;
using DevFlow.Infrastructure.Email;
using DevFlow.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pgvector.EntityFrameworkCore;

namespace DevFlow.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.Configure<OAuthSettings>(configuration.GetSection(OAuthSettings.SectionName));
        services.Configure<AiOptions>(configuration.GetSection(AiOptions.SectionName));

        // AI planner: provider-specific client when a key is configured, no-op
        // fallback otherwise so the API stays responsive without an AI key.
        // Provider is chosen explicitly ("gemini" → Google Generative Language
        // API, anything else with a key → OpenAI-compatible chat/completions).
        // Embedding clients follow the same branch so RAG uses the same
        // provider + ApiKey as chat (Gemini text-embedding-004 / OpenAI
        // text-embedding-3-small with dimensions=768).
        if (!string.IsNullOrWhiteSpace(configuration["Ai:ApiKey"]))
        {
            if (string.Equals(configuration["Ai:Provider"], "gemini", StringComparison.OrdinalIgnoreCase))
            {
                services.AddHttpClient<IAiClient, GeminiAiClient>();
                services.AddHttpClient<IEmbeddingClient, GeminiEmbeddingClient>();
            }
            else
            {
                services.AddHttpClient<IAiClient, OpenAiAiClient>();
                services.AddHttpClient<IEmbeddingClient, OpenAiEmbeddingClient>();
            }
        }
        else
        {
            services.AddScoped<IAiClient, NoOpAiClient>();
            services.AddScoped<IEmbeddingClient, NoOpEmbeddingClient>();
        }

        // RAG pipeline: chunker + optional re-rank (default NoOp / off) + async
        // ingestion (outbox knowledge.reembed) + retrieval with weight fallback.
        services.AddScoped<IContentChunker, ContentChunker>();
        services.AddScoped<IReranker>(_ => new NoOpReranker());
        services.AddScoped<IKnowledgeIngestionService, KnowledgeIngestionService>();
        services.AddScoped<IKnowledgeRetrievalService, KnowledgeRetrievalService>();

        services.AddSingleton<AuditableEntityInterceptor>();
        services.AddSingleton<SoftDeleteInterceptor>();

        services.AddDbContext<DevFlowDbContext>((sp, options) =>
        {
            options
                .UseNpgsql(configuration.GetConnectionString("Database"), o => o.UseVector())
                .UseSnakeCaseNamingConvention()
                .AddInterceptors(
                    sp.GetRequiredService<AuditableEntityInterceptor>(),
                    sp.GetRequiredService<SoftDeleteInterceptor>());
        });

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IWorkspaceRepository, WorkspaceRepository>();
        services.AddScoped<IWorkspaceInvitationRepository, WorkspaceInvitationRepository>();
        services.AddScoped<ISearchRepository, SearchRepository>();
        services.AddScoped<IProjectRepository, ProjectRepository>();
        services.AddScoped<IProjectMemberRepository, ProjectMemberRepository>();
        services.AddScoped<ITaskItemRepository, TaskItemRepository>();
        services.AddScoped<ICommentRepository, CommentRepository>();
        services.AddScoped<ISprintRepository, SprintRepository>();
        services.AddScoped<IEpicRepository, EpicRepository>();
        services.AddScoped<IMilestoneRepository, MilestoneRepository>();
        services.AddScoped<IKnowledgeRepository, KnowledgeRepository>();
        services.AddScoped<IAiPlanRepository, AiPlanRepository>();
        services.AddScoped<IEpicDependencyRepository, EpicDependencyRepository>();
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
        services.AddScoped<IRecurringTaskRuleRepository, RecurringTaskRuleRepository>();
        services.AddHostedService<OutboxProcessor>();
        services.AddHostedService<RecurringTaskProcessor>();
        services.AddHttpClient("Webhooks");
        if (!string.IsNullOrWhiteSpace(configuration["RESEND_API_KEY"]))
        {
            // Explicit timeout: HttpClient otherwise waits 100 seconds, so a
            // Resend outage would hold each caller's request open for over a
            // minute and a minute and a half. 10s is well inside the budget
            // the mail API itself needs, and the send is fire-and-forget
            // anyway — the caller has already moved on.
            services.AddHttpClient<IEmailService, ResendEmailService>(client =>
            {
                client.Timeout = TimeSpan.FromSeconds(10);
            });
        }
        else
        {
            // Not a no-op: registration is gated on a verification link, so
            // without a mail provider the link is logged rather than dropped.
            // See ConsoleLogEmailService.
            services.AddScoped<IEmailService, ConsoleLogEmailService>();
        }
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddScoped<ITokenProvider, JwtTokenProvider>();
        services.AddSingleton<IEmailVerificationTokenProvider, EmailVerificationTokenProvider>();
        services.AddScoped<IEmailVerificationLinkBuilder, EmailVerificationLinkBuilder>();
        services.AddScoped<IExternalIdentityProvider, GoogleIdentityProvider>();
        services.AddScoped<IExternalIdentityProvider, GitHubIdentityProvider>();
        services.AddHttpClient("OAuth");
        services.AddScoped<IGitHubApiClient, GitHubApiClient>();
        services.AddHttpClient("GitHubApi", client =>
        {
            client.BaseAddress = new Uri("https://api.github.com/");
            client.DefaultRequestHeaders.UserAgent.ParseAdd("DevFlow");
            client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        });

        // MemoryCache is the default: the deployment is a single Render
        // instance, so a process-local cache gives the same wins as Redis
        // without the connection or the round-trip. Redis is used when a
        // connection string is provided (multi-instance setups); if even
        // connecting fails, the in-memory cache still serves reads instead
        // of degrading to no caching at all.
        services.AddMemoryCache();
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
                services.AddSingleton<ICacheService, MemoryCacheService>();
            }
        }
        else
        {
            services.AddSingleton<ICacheService, MemoryCacheService>();
        }

        return services;
    }
}
