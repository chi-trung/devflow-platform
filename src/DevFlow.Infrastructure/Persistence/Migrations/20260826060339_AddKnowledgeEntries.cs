using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKnowledgeEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "knowledge_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    task_id = table.Column<Guid>(type: "uuid", nullable: true),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    body = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: true),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    weight = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: false),
                    tags = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    superseded_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_knowledge_entries_knowledge_entries_superseded_by_id",
                        column: x => x.superseded_by_id,
                        principalTable: "knowledge_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_knowledge_entries_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_knowledge_entries_task_items_task_id",
                        column: x => x.task_id,
                        principalTable: "task_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_entries_project_id_status",
                table: "knowledge_entries",
                columns: new[] { "project_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_entries_project_id_type",
                table: "knowledge_entries",
                columns: new[] { "project_id", "type" });

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_entries_superseded_by_id",
                table: "knowledge_entries",
                column: "superseded_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_entries_task_id",
                table: "knowledge_entries",
                column: "task_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "knowledge_entries");
        }
    }
}
