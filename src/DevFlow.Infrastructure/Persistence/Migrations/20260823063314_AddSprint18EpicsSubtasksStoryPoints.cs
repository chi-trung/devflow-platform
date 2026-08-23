using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSprint18EpicsSubtasksStoryPoints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "epic_id",
                table: "task_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "parent_task_id",
                table: "task_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "story_points",
                table: "task_items",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "epics",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                    start_date_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    end_date_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_epics", x => x.id);
                    table.ForeignKey(
                        name: "fk_epics_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_task_items_epic_id",
                table: "task_items",
                column: "epic_id");

            migrationBuilder.CreateIndex(
                name: "ix_task_items_parent_task_id",
                table: "task_items",
                column: "parent_task_id");

            migrationBuilder.CreateIndex(
                name: "ix_epics_project_id_start_date_utc",
                table: "epics",
                columns: new[] { "project_id", "start_date_utc" });

            migrationBuilder.AddForeignKey(
                name: "fk_task_items_epics_epic_id",
                table: "task_items",
                column: "epic_id",
                principalTable: "epics",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_task_items_task_items_parent_task_id",
                table: "task_items",
                column: "parent_task_id",
                principalTable: "task_items",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_task_items_epics_epic_id",
                table: "task_items");

            migrationBuilder.DropForeignKey(
                name: "fk_task_items_task_items_parent_task_id",
                table: "task_items");

            migrationBuilder.DropTable(
                name: "epics");

            migrationBuilder.DropIndex(
                name: "ix_task_items_epic_id",
                table: "task_items");

            migrationBuilder.DropIndex(
                name: "ix_task_items_parent_task_id",
                table: "task_items");

            migrationBuilder.DropColumn(
                name: "epic_id",
                table: "task_items");

            migrationBuilder.DropColumn(
                name: "parent_task_id",
                table: "task_items");

            migrationBuilder.DropColumn(
                name: "story_points",
                table: "task_items");
        }
    }
}
