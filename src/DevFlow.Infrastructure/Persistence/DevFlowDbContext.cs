using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

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

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<TaskItem> TaskItems => Set<TaskItem>();

    public DbSet<Comment> Comments => Set<Comment>();

    public DbSet<Sprint> Sprints => Set<Sprint>();

    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    public DbSet<TaskAttachment> TaskAttachments => Set<TaskAttachment>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<Label> Labels => Set<Label>();

    public DbSet<TaskLabel> TaskLabels => Set<TaskLabel>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DevFlowDbContext).Assembly);
    }
}
