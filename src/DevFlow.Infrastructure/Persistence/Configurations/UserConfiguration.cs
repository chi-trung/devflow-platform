using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(user => user.Id);

        builder.Property(user => user.Email)
            .HasMaxLength(255);

        // Partial index, not a plain unique one. Registration no longer
        // collects an address, so any number of accounts have email = null and
        // a full unique index would make the second sign-up fail with a unique
        // violation. Postgres already treats NULLs as distinct, but stating the
        // filter keeps the model honest instead of leaning on that default.
        builder.HasIndex(user => user.Email)
            .IsUnique()
            .HasFilter("email IS NOT NULL");

        builder.Property(user => user.Username)
            .HasMaxLength(50)
            .IsRequired();

        builder.HasIndex(user => user.Username)
            .IsUnique();

        builder.Property(user => user.PasswordHash)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(user => user.DisplayName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(user => user.AvatarUrl)
            .HasMaxLength(500);

        builder.Property(user => user.EmailVerifiedAtUtc);

        builder.Property(user => user.EmailVerificationSentAtUtc);

        builder.Property(user => user.PasswordResetSentAtUtc);
    }
}
