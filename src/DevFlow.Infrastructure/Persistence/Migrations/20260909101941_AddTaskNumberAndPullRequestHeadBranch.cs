using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskNumberAndPullRequestHeadBranch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Nullable first — existing rows have no number yet.
            migrationBuilder.AddColumn<int>(
                name: "number",
                table: "task_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "head_branch",
                table: "PullRequests",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            // 2. Backfill: number tasks per project oldest-first (1-based),
            //    matching the "{Project.Key}-{Number}" key convention.
            migrationBuilder.Sql(
                """
                UPDATE task_items AS t
                SET number = s.rn
                FROM (
                    SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY created_at_utc, id) AS rn
                    FROM task_items
                ) AS s
                WHERE t.id = s.id;
                """);

            // 3. Now that every row has a distinct number, enforce not-null + uniqueness.
            migrationBuilder.AlterColumn<int>(
                name: "number",
                table: "task_items",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_task_items_project_id_number",
                table: "task_items",
                columns: new[] { "project_id", "number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_task_items_project_id_number",
                table: "task_items");

            migrationBuilder.DropColumn(
                name: "number",
                table: "task_items");

            migrationBuilder.DropColumn(
                name: "head_branch",
                table: "PullRequests");
        }
    }
}
