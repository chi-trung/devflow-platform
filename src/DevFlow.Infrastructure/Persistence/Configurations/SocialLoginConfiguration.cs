using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class SocialLoginConfiguration : IEntityTypeConfiguration<SocialLogin>
{
    public void Configure(EntityTypeBuilder<SocialLogin> builder)
    {
        builder.ToTable("social_logins");

        builder.HasKey(login => login.Id);

        builder.Property(login => login.Provider)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(login => login.Subject)
            .HasMaxLength(255)
            .IsRequired();

        // Fast lookup: "find the user with this provider + subject"
        builder.HasIndex(login => new { login.Provider, login.Subject })
            .IsUnique();

        // Per-user listing of linked accounts
        builder.HasIndex(login => new { login.UserId, login.Provider });

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(login => login.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}