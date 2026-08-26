using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEpicMilestoneForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "milestone_id",
                table: "epics",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_epics_milestone_id",
                table: "epics",
                column: "milestone_id");

            migrationBuilder.AddForeignKey(
                name: "fk_epics_milestones_milestone_id",
                table: "epics",
                column: "milestone_id",
                principalTable: "milestones",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_epics_milestones_milestone_id",
                table: "epics");

            migrationBuilder.DropIndex(
                name: "ix_epics_milestone_id",
                table: "epics");

            migrationBuilder.DropColumn(
                name: "milestone_id",
                table: "epics");
        }
    }
}
