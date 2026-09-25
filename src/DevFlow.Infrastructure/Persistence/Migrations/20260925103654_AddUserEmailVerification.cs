using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserEmailVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "email_verification_sent_at_utc",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "email_verified_at_utc",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            // Every account that exists today was created before verification
            // existed, so none of them can ever receive or click a link. Mark
            // them verified now — without this backfill, deploying the feature
            // would lock out every current user with a 403 on their next call.
            migrationBuilder.Sql(
                """
                UPDATE users SET email_verified_at_utc = now();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "email_verification_sent_at_utc",
                table: "users");

            migrationBuilder.DropColumn(
                name: "email_verified_at_utc",
                table: "users");
        }
    }
}
