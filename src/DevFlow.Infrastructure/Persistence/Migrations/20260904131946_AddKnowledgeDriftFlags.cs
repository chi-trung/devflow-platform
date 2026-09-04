using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKnowledgeDriftFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "drift_reason",
                table: "knowledge_entries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "drifted_at_utc",
                table: "knowledge_entries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "needs_review",
                table: "knowledge_entries",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "drift_reason",
                table: "knowledge_entries");

            migrationBuilder.DropColumn(
                name: "drifted_at_utc",
                table: "knowledge_entries");

            migrationBuilder.DropColumn(
                name: "needs_review",
                table: "knowledge_entries");
        }
    }
}
