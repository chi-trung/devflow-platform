using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOutboxDeadLetterQueue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_outbox_messages_processed_at_utc_occurred_at_utc",
                table: "outbox_messages");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "failed_permanently_at",
                table: "outbox_messages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_outbox_messages_processed_at_utc_failed_permanently_at_occu",
                table: "outbox_messages",
                columns: new[] { "processed_at_utc", "failed_permanently_at", "occurred_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_outbox_messages_processed_at_utc_failed_permanently_at_occu",
                table: "outbox_messages");

            migrationBuilder.DropColumn(
                name: "failed_permanently_at",
                table: "outbox_messages");

            migrationBuilder.CreateIndex(
                name: "ix_outbox_messages_processed_at_utc_occurred_at_utc",
                table: "outbox_messages",
                columns: new[] { "processed_at_utc", "occurred_at_utc" });
        }
    }
}
