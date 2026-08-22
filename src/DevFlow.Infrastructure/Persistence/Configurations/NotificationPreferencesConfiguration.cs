using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class NotificationPreferencesConfiguration : IEntityTypeConfiguration<NotificationPreferences>
{
    public void Configure(EntityTypeBuilder<NotificationPreferences> builder)
    {
        builder.HasKey(np => np.Id);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(np => np.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(np => np.UserId).IsUnique();
    }
}
