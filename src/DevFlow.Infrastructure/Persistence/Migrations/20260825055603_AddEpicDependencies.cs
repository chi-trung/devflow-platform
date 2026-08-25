using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEpicDependencies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "epic_dependencies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    epic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    blocked_by_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_epic_dependencies", x => x.id);
                    table.ForeignKey(
                        name: "fk_epic_dependencies_epics_blocked_by_id",
                        column: x => x.blocked_by_id,
                        principalTable: "epics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_epic_dependencies_epics_epic_id",
                        column: x => x.epic_id,
                        principalTable: "epics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_epic_dependencies_blocked_by_id",
                table: "epic_dependencies",
                column: "blocked_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_epic_dependencies_epic_id_blocked_by_id",
                table: "epic_dependencies",
                columns: new[] { "epic_id", "blocked_by_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "epic_dependencies");
        }
    }
}
