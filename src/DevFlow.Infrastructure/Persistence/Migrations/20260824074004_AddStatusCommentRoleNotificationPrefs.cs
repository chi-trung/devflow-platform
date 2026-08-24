using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStatusCommentRoleNotificationPrefs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "email_on_comment_added",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "email_on_removed_from_workspace",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "email_on_role_changed",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "email_on_status_changed",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "in_app_on_comment_added",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "in_app_on_removed_from_workspace",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "in_app_on_role_changed",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "in_app_on_status_changed",
                table: "notification_preferences",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "email_on_comment_added",
                table: "notification_preferences");

            migrationBuilder.DropColumn(
                name: "email_on_removed_from_workspace",
                table: "notification_preferences");

            migrationBuilder.DropColumn(
                name: "email_on_role_changed",
                table: "notification_preferences");

            migrationBuilder.DropColumn(
                name: "email_on_status_changed",
                table: "notification_preferences");

            migrationBuilder.DropColumn(
                name: "in_app_on_comment_added",
                table: "notification_preferences");

            migrationBuilder.DropColumn(
                name: "in_app_on_removed_from_workspace",
                table: "notification_preferences");

            migrationBuilder.DropColumn(
                name: "in_app_on_role_changed",
                table: "notification_preferences");

            migrationBuilder.DropColumn(
                name: "in_app_on_status_changed",
                table: "notification_preferences");
        }
    }
}
