using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CanonicalizeGitHubRepositoryUrls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Backfill integrations linked before GitHubIntegration.Create
            // started canonicalizing: ssh/www/.git/trailing-slash/odd-casing
            // rows never matched a webhook delivery's repository.html_url and
            // silently dropped every event for that repository. Rewrite to the
            // same key the runtime writes (https, lowercased slug) using the
            // exact regex from DevFlow.Domain.Common.GitHubUrl. Non-GitHub
            // rows (m IS NULL) keep their stored value untouched — the lookup
            // against them fails the same way it already did.
            migrationBuilder.Sql("""
                UPDATE "GitHubIntegrations" gi
                SET repository_url = 'https://github.com/' || lower(m[1]) || '/' || lower(m[2])
                FROM (
                    SELECT id,
                           regexp_match(
                               lower(btrim(repository_url)),
                               '^(?:(?:https?|ssh)://)?(?:[a-z0-9._-]+@)?(?:www\.)?github\.com[/:]([^/]+)/([^/?#]+?)(?:\.git)?(?:[/#?].*)?$'
                           ) AS m
                    FROM "GitHubIntegrations"
                ) src
                WHERE src.id = gi.id
                  AND src.m IS NOT NULL
                  AND gi.repository_url IS DISTINCT FROM 'https://github.com/' || lower(src.m[1]) || '/' || lower(src.m[2]);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Not reversible — the pre-canonicalization casing/suffix of each
            // legacy row was never recorded anywhere.
        }
    }
}
