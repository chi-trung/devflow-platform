using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.IntegrationTests;

/// <summary>
/// Checks the migrated schema itself, not the behaviour built on top of it.
///
/// The app runs <c>Database.Migrate()</c> at boot (Program.cs:300), so a
/// migration that does not apply is not a test failure — it is an API that
/// does not start. That makes the schema worth asserting directly: these
/// queries are the only place anything notices that the column stopped being
/// mandatory, or that the unique index lost its full-table coverage.
///
/// Every write here is raw SQL, on purpose. Going through the DbContext would
/// only prove the application can store what it already knows how to store;
/// a hand-written INSERT is what actually exercises the column constraint and
/// the index.
/// </summary>
[Collection("IntegrationTests")]
public class MigrationAppliedIntegrationTests(DevFlowWebApplicationFactory factory)
{
    [Fact]
    public async Task Users_Email_IsNullable_AndUniquelyIndexedOnlyWhenPresent()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var client = factory.CreateClient();
        await RegistrationFlow.AuthenticateAsync(factory, client, "Schema Tester");

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider
            .GetRequiredService<DevFlow.Infrastructure.Persistence.DevFlowDbContext>();

        // 1. The column must accept null, and must accept it more than once.
        //    This is the whole change: an account registered through the
        //    current form has no address, so any number of them can exist.
        var insertError = await Record.ExceptionAsync(async () =>
        {
            await db.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO users (id, username, password_hash, display_name, email, created_at_utc)
                VALUES ({0}, 'n1', 'hash', 'No One', NULL, now()),
                       ({1}, 'n2', 'hash', 'No One Two', NULL, now())
                """,
                Guid.NewGuid(), Guid.NewGuid());
        });

        Assert.Null(insertError);

        // Confirm they really are null rather than silently defaulting to "".
        var nullCount = await db.Database.SqlQueryRaw<int>(
                """
                SELECT count(*)::int AS "Value"
                FROM users
                WHERE username IN ('n1', 'n2') AND email IS NULL
                """)
            .ToListAsync();
        Assert.Equal(2, nullCount.Single());

        // 2. The unique index must be partial. On a plain unique index the two
        //    rows above would collide the moment both were null — Postgres only
        //    tolerates it because NULLs are distinct, which is a database
        //    default this schema deliberately does not depend on.
        var indexDef = await db.Database.SqlQueryRaw<string>(
                """
                SELECT indexdef AS "Value"
                FROM pg_indexes
                WHERE tablename = 'users' AND indexname = 'ix_users_email'
                """)
            .ToListAsync();

        var definition = indexDef.Single();
        Assert.Contains("UNIQUE", definition);
        Assert.Contains("WHERE (email IS NOT NULL)", definition);

        // 3. A duplicate non-null address must still be refused. A partial
        //    index that lost its uniqueness would let two accounts claim the
        //    same inbox, which is the original problem in reverse — so the
        //    filter must narrow the index, not weaken it.
        var duplicateError = await Record.ExceptionAsync(async () =>
        {
            await db.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO users (id, username, password_hash, display_name, email, created_at_utc)
                VALUES ({0}, 'dup_a', 'hash', 'Dup A', 'dup@devflow.local', now()),
                       ({1}, 'dup_b', 'hash', 'Dup B', 'dup@devflow.local', now())
                """,
                Guid.NewGuid(), Guid.NewGuid());
        });

        Assert.NotNull(duplicateError);
    }
}
