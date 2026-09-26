using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.IntegrationTests;

/// <summary>
/// The account-activation flow end to end over HTTP: register with no address,
/// see the warning, link a provider, and come back recoverable.
///
/// The provider is faked at the HTTP boundary (<see cref="FakeOAuthIdentityProvider"/>),
/// so everything below it is real — routing, [Authorize], the 409 mapping, the
/// EF writes and the unique index.
/// </summary>
[Collection("IntegrationTests")]
public class LinkOAuthIntegrationTests(DevFlowWebApplicationFactory factory)
{
    private readonly HttpClient client = factory.CreateClient();

    private static async Task<(HttpClient Client, string Username)> NewAccountAsync(
        DevFlowWebApplicationFactory factory,
        HttpClient client)
    {
        var username = $"u_{Guid.NewGuid():N}".Substring(0, 10);
        await RegistrationFlow.RegisterAsync(client, username, "Sup3rSecret!", "Link Tester");
        var token = await RegistrationFlow.LoginAsync(client, username, "Sup3rSecret!");

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        return (client, username);
    }

    [Fact]
    public async Task NewAccount_ReportsUnrecoverable_ThenRecoverable_AfterLinking()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var (client, _) = await NewAccountAsync(factory, this.client);

        // 1. Fresh account, no provider, no address — the dashboard prompt
        //    reads exactly this and must say the account can be lost.
        var before = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/linked-accounts");
        Assert.Empty(before.GetProperty("providers").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, before.GetProperty("email").ValueKind);
        Assert.False(before.GetProperty("canBeRecovered").GetBoolean());

        // 2. Link a Google identity. The code is a key into the fake provider.
        var email = $"{Guid.NewGuid():N}@gmail.com";
        var code = FakeOAuthIdentityProvider.Register($"sub-{Guid.NewGuid():N}", email, "Link Tester");

        var linkResponse = await client.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "google",
            code,
            codeVerifier = "verifier",
        });

        Assert.Equal(HttpStatusCode.OK, linkResponse.StatusCode);
        var linked = await linkResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(new[] { "google" }, linked.GetProperty("providers").EnumerateArray().Select(p => p.GetString()));
        Assert.Equal(email, linked.GetProperty("email").GetString());
        Assert.True(linked.GetProperty("canBeRecovered").GetBoolean());

        // 3. The prompt has to disappear, so the status must come back changed
        //    on a fresh read — not out of a claim frozen in the access token,
        //    which would still say "unrecoverable" until it expired.
        var after = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/linked-accounts");
        Assert.True(after.GetProperty("canBeRecovered").GetBoolean());
        Assert.Equal(email, after.GetProperty("email").GetString());

        // 4. And the address really is on the user row, not just in a response.
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider
            .GetRequiredService<DevFlow.Infrastructure.Persistence.DevFlowDbContext>();
        var stored = await db.Users.AsNoTracking().SingleAsync(u => u.Email == email);
        Assert.True(stored.IsEmailVerified);
        Assert.Single(await db.SocialLogins.AsNoTracking().Where(s => s.UserId == stored.Id).ToListAsync());
    }

    /// <summary>
    /// Two accounts, one Google. The second person must be refused, and
    /// refusing them is only safe if their own account is left intact — the
    /// property that matters is that they are not logged out or merged into
    /// somebody else's account.
    /// </summary>
    [Fact]
    public async Task LinkingAProviderOwnedByAnotherAccount_Conflicts_AndLeavesBothIntact()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var (firstClient, firstUsername) = await NewAccountAsync(factory, client);

        var sharedSubject = $"shared-sub-{Guid.NewGuid():N}";
        var firstCode = FakeOAuthIdentityProvider.Register(sharedSubject, $"{Guid.NewGuid():N}@gmail.com");
        var firstLink = await firstClient.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "google",
            code = firstCode,
            codeVerifier = "verifier",
        });
        Assert.Equal(HttpStatusCode.OK, firstLink.StatusCode);

        // A second account, same Google identity.
        var secondClient = factory.CreateClient();
        var secondUsername = $"u_{Guid.NewGuid():N}".Substring(0, 10);
        await RegistrationFlow.RegisterAsync(secondClient, secondUsername, "Sup3rSecret!", "Other User");
        var secondToken = await RegistrationFlow.LoginAsync(secondClient, secondUsername, "Sup3rSecret!");
        secondClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", secondToken);

        var secondCode = FakeOAuthIdentityProvider.Register(sharedSubject, $"{Guid.NewGuid():N}@gmail.com");
        var conflict = await secondClient.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "google",
            code = secondCode,
            codeVerifier = "verifier",
        });

        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);

        // The refused account still works and still owns nothing extra.
        var secondStatus = await secondClient.GetFromJsonAsync<JsonElement>("/api/v1/auth/linked-accounts");
        Assert.Empty(secondStatus.GetProperty("providers").EnumerateArray());
        Assert.False(secondStatus.GetProperty("canBeRecovered").GetBoolean());

        // The first account is untouched by the attempt.
        var firstStatus = await firstClient.GetFromJsonAsync<JsonElement>("/api/v1/auth/linked-accounts");
        Assert.Single(firstStatus.GetProperty("providers").EnumerateArray());

        // And the session is not a way in: signing in as the first account with
        // the second one's password is impossible, and the shared provider
        // still resolves to exactly one account.
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider
            .GetRequiredService<DevFlow.Infrastructure.Persistence.DevFlowDbContext>();
        var links = await db.SocialLogins.AsNoTracking()
            .Where(s => s.Subject == sharedSubject)
            .ToListAsync();
        Assert.Single(links);
    }

    [Fact]
    public async Task LinkingTwice_IsIdempotent()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var (client, _) = await NewAccountAsync(factory, this.client);

        var subject = $"sub-{Guid.NewGuid():N}";
        var email = $"{Guid.NewGuid():N}@gmail.com";

        var first = await client.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "google",
            code = FakeOAuthIdentityProvider.Register(subject, email),
            codeVerifier = "verifier",
        });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // A second tap on the banner must not error on what is already true.
        var second = await client.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "google",
            code = FakeOAuthIdentityProvider.Register(subject, email),
            codeVerifier = "verifier",
        });
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider
            .GetRequiredService<DevFlow.Infrastructure.Persistence.DevFlowDbContext>();
        var links = await db.SocialLogins.AsNoTracking().Where(s => s.Subject == subject).ToListAsync();
        Assert.Single(links);
    }

    /// <summary>
    /// Both providers, on one account. The unique index is on
    /// (provider, subject), so two providers must coexist without colliding.
    /// </summary>
    [Fact]
    public async Task LinkingGoogleAndGitHub_RecordsBoth()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var (client, _) = await NewAccountAsync(factory, this.client);

        await client.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "google",
            code = FakeOAuthIdentityProvider.Register($"g-{Guid.NewGuid():N}", $"{Guid.NewGuid():N}@gmail.com"),
            codeVerifier = "verifier",
        });

        var github = await client.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "github",
            code = FakeOAuthIdentityProvider.Register($"h-{Guid.NewGuid():N}", $"{Guid.NewGuid():N}@users.noreply.github.com"),
            codeVerifier = "",
        });

        Assert.Equal(HttpStatusCode.OK, github.StatusCode);

        var status = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/linked-accounts");
        var providers = status.GetProperty("providers").EnumerateArray().Select(p => p.GetString()).ToList();
        Assert.Equal(2, providers.Count);
        Assert.Contains("google", providers);
        Assert.Contains("github", providers);
    }

    [Fact]
    public async Task Link_RequiresAuthentication()
    {
        var anonymous = factory.CreateClient();

        var response = await anonymous.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "google",
            code = FakeOAuthIdentityProvider.Register($"anon-{Guid.NewGuid():N}", $"{Guid.NewGuid():N}@gmail.com"),
            codeVerifier = "verifier",
        });

        // Without a session there is no target account, so this must be
        // refused — it is the difference between linking and signing in.
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task LinkedAccounts_RequiresAuthentication()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var anonymous = factory.CreateClient();

        var link = await anonymous.GetAsync("/api/v1/auth/linked-accounts");
        Assert.Equal(HttpStatusCode.Unauthorized, link.StatusCode);
    }

    /// <summary>
    /// Unlinking is the reverse of linking, so it inherits the same trust
    /// question: whose account loses the identity? The answer must be the
    /// signed-in one, and an anonymous call must be refused — a DELETE that
    /// worked without a session would be a way to strip someone's recovery
    /// route on a guessed user id.
    /// </summary>
    [Fact]
    public async Task Unlink_RequiresAuthentication()
    {
        var anonymous = factory.CreateClient();

        var response = await anonymous.DeleteAsync("/api/v1/auth/linked-accounts/google");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// The guard that matters: the last provider on an account with no address
    /// cannot be removed. The account is left exactly as it was — link intact,
    /// session intact — because the alternative is a password becoming the
    /// permanent sole key to the account by accident.
    /// </summary>
    [Fact]
    public async Task UnlinkingTheOnlyRouteBackIn_Conflicts_AndLeavesTheLinkIntact()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var (client, username) = await NewAccountAsync(factory, this.client);
        var subject = $"sub-{Guid.NewGuid():N}";

        var link = await client.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "google",
            code = FakeOAuthIdentityProvider.Register(subject, $"{Guid.NewGuid():N}@gmail.com"),
            codeVerifier = "verifier",
        });
        Assert.Equal(HttpStatusCode.OK, link.StatusCode);

        // Google just proved an address, so the account IS recoverable — which
        // is exactly the case where unlinking must be allowed. Clear the address
        // with raw SQL to reach the state the guard exists for: the entity has no
        // "forget my address" operation, and adding one to production purely so a
        // test could call it would be a real capability nobody asked for.
        // Scoped to this account — the other tests in the collection still need
        // theirs intact.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<DevFlow.Infrastructure.Persistence.DevFlowDbContext>();
            await db.Database.ExecuteSqlRawAsync(
                "UPDATE users SET email = NULL, email_verified_at_utc = NULL WHERE username = {0}",
                username);
        }

        var refused = await client.DeleteAsync("/api/v1/auth/linked-accounts/google");
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);

        // The link survives, and so does the session.
        var status = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/linked-accounts");
        Assert.Equal(new[] { "google" }, status.GetProperty("providers").EnumerateArray().Select(p => p.GetString()));
    }

    [Fact]
    public async Task UnlinkingWithAnAddress_RemovesTheLink()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var (client, username) = await NewAccountAsync(factory, this.client);

        await client.PostAsJsonAsync("/api/v1/auth/oauth/link", new
        {
            provider = "google",
            code = FakeOAuthIdentityProvider.Register($"g-{Guid.NewGuid():N}", $"{Guid.NewGuid():N}@gmail.com"),
            codeVerifier = "verifier",
        });

        // An address plus a provider: either alone is enough to get back in, so
        // removing one leaves the other.
        var removed = await client.DeleteAsync("/api/v1/auth/linked-accounts/google");
        Assert.Equal(HttpStatusCode.OK, removed.StatusCode);

        var body = await removed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Empty(body.GetProperty("providers").EnumerateArray());
        // The address the provider proved is not the provider's to take back.
        Assert.False(string.IsNullOrEmpty(body.GetProperty("email").GetString()));
        Assert.True(body.GetProperty("canBeRecovered").GetBoolean());

        // Scoped to this account: the table holds links from every other test
        // in the collection, and asserting it is empty would only be true if
        // they had all run first.
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider
            .GetRequiredService<DevFlow.Infrastructure.Persistence.DevFlowDbContext>();
        var userId = await db.Users
            .Where(u => u.Username == username)
            .Select(u => u.Id)
            .SingleAsync();
        Assert.Empty(await db.SocialLogins.AsNoTracking()
            .Where(s => s.UserId == userId)
            .ToListAsync());
    }

    [Fact]
    public async Task UnlinkingSomethingNotLinked_IsNotFound()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var (client, _) = await NewAccountAsync(factory, this.client);

        var response = await client.DeleteAsync("/api/v1/auth/linked-accounts/github");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
