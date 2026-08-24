using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInAppNotificationPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "in_app_on_assignment",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "in_app_on_mention",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "in_app_on_sprint_started",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "in_app_on_assignment",
                table: "notification_preferences");

            migrationBuilder.DropColumn(
                name: "in_app_on_mention",
                table: "notification_preferences");

            migrationBuilder.DropColumn(
                name: "in_app_on_sprint_started",
                table: "notification_preferences");
        }
    }
}
