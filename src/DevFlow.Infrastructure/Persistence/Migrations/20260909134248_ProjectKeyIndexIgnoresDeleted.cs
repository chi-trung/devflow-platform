using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProjectKeyIndexIgnoresDeleted : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_projects_workspace_id_key",
                table: "projects");

            migrationBuilder.CreateIndex(
                name: "ix_projects_workspace_id_key",
                table: "projects",
                columns: new[] { "workspace_id", "key" },
                unique: true,
                filter: "deleted_at_utc IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_projects_workspace_id_key",
                table: "projects");

            migrationBuilder.CreateIndex(
                name: "ix_projects_workspace_id_key",
                table: "projects",
                columns: new[] { "workspace_id", "key" },
                unique: true);
        }
    }
}
