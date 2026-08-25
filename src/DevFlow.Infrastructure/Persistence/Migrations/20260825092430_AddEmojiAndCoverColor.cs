using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmojiAndCoverColor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "emoji",
                table: "workspaces",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cover_color",
                table: "projects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "emoji",
                table: "projects",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "emoji",
                table: "workspaces");

            migrationBuilder.DropColumn(
                name: "cover_color",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "emoji",
                table: "projects");
        }
    }
}
