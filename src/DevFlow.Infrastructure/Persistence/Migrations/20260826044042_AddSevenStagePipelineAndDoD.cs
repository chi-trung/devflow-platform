using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSevenStagePipelineAndDoD : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "definition_of_done",
                table: "task_items",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            // 4-stage → 7-stage pipeline rename. Enum values are stored as their
            // string names, so remap existing rows:
            //   "Backlog"  → "Idea"    (new default stage)
            //   "InReview" → "Review"  (renamed member)
            migrationBuilder.Sql(
                "UPDATE task_items SET status = 'Idea' WHERE status = 'Backlog';");
            migrationBuilder.Sql(
                "UPDATE task_items SET status = 'Review' WHERE status = 'InReview';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE task_items SET status = 'Backlog' WHERE status = 'Idea';");
            migrationBuilder.Sql(
                "UPDATE task_items SET status = 'InReview' WHERE status = 'Review';");

            migrationBuilder.DropColumn(
                name: "definition_of_done",
                table: "task_items");
        }
    }
}
