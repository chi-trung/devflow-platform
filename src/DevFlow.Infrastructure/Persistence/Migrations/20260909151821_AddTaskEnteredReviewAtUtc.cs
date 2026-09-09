using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskEnteredReviewAtUtc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "entered_review_at_utc",
                table: "task_items",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "entered_review_at_utc",
                table: "task_items");
        }
    }
}
