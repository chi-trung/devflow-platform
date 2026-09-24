using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Pgvector.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence;

public class DevFlowDbContext : DbContext
{
    public DevFlowDbContext(DbContextOptions<DevFlowDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<Workspace> Workspaces => Set<Workspace>();

    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();

    public DbSet<WorkspaceInvitation> WorkspaceInvitations => Set<WorkspaceInvitation>();

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();

    public DbSet<TaskItem> TaskItems => Set<TaskItem>();

    public DbSet<Comment> Comments => Set<Comment>();

    public DbSet<Sprint> Sprints => Set<Sprint>();

    public DbSet<Epic> Epics => Set<Epic>();

    public DbSet<EpicDependency> EpicDependencies => Set<EpicDependency>();

    public DbSet<Milestone> Milestones => Set<Milestone>();

    public DbSet<KnowledgeEntry> KnowledgeEntries => Set<KnowledgeEntry>();

    public DbSet<KnowledgeChunk> KnowledgeChunks => Set<KnowledgeChunk>();

    public DbSet<AiPlan> AiPlans => Set<AiPlan>();

    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    public DbSet<TaskAttachment> TaskAttachments => Set<TaskAttachment>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<Label> Labels => Set<Label>();

    public DbSet<TaskLabel> TaskLabels => Set<TaskLabel>();

    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();

    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();

    public DbSet<GitHubIntegration> GitHubIntegrations => Set<GitHubIntegration>();

    public DbSet<PullRequest> PullRequests => Set<PullRequest>();

    public DbSet<TaskTemplate> TaskTemplates => Set<TaskTemplate>();

    public DbSet<CustomField> CustomFields => Set<CustomField>();

    public DbSet<TaskCustomFieldValue> TaskCustomFieldValues => Set<TaskCustomFieldValue>();

    public DbSet<Webhook> Webhooks => Set<Webhook>();

    public DbSet<NotificationPreferences> NotificationPreferences => Set<NotificationPreferences>();

    public DbSet<SavedSearch> SavedSearches => Set<SavedSearch>();

    public DbSet<PersonalAccessToken> PersonalAccessTokens => Set<PersonalAccessToken>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<TaskWatcher> TaskWatchers => Set<TaskWatcher>();

    public DbSet<SocialLogin> SocialLogins => Set<SocialLogin>();

    public DbSet<RecurringTaskRule> RecurringTaskRules => Set<RecurringTaskRule>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DevFlowDbContext).Assembly);

        // knowledge_chunks.embedding is pgvector vector(768). The InMemory
        // provider (integration fallback without Docker) cannot map
        // Pgvector.Vector, so drop the column from that model — retrieval
        // then falls back to weight order (Embedding stays null in memory).
        if (Database.IsRelational())
        {
            modelBuilder.HasPostgresExtension("vector");
        }
        else
        {
            modelBuilder.Entity<KnowledgeChunk>().Ignore(c => c.Embedding);
        }

        modelBuilder.Entity<Project>().HasQueryFilter(p => p.DeletedAtUtc == null);
        modelBuilder.Entity<TaskItem>().HasQueryFilter(t => t.DeletedAtUtc == null);
        // Also set in RecurringTaskRuleConfiguration; kept here beside the
        // other soft-delete filters so a model-level sweep does not miss it.
        modelBuilder.Entity<RecurringTaskRule>().HasQueryFilter(r => r.DeletedAtUtc == null);
    }
}
