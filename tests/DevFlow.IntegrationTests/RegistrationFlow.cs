using System.Net.Http.Json;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.IntegrationTests;

/// <summary>
/// The register → verify → sign-in sequence every authenticated integration
/// test has to walk, gathered in one place so the flow is changed once.
///
/// The verification step resolves the real token provider from the host rather
/// than stubbing it, so these tests exercise the actual signed-token path end
/// to end. Minting the token here is the test standing in for the recipient
/// clicking the link in their inbox — there is no inbox in CI to click.
/// </summary>
internal static class RegistrationFlow
{
    /// <summary>
    /// Registers an account and returns its id. The account is NOT verified
    /// yet — call <see cref="VerifyAsync"/> to finish the sequence.
    /// </summary>
    public static async Task<Guid> RegisterAsync(
        HttpClient client,
        string email,
        string username,
        string password,
        string displayName)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            username,
            password,
            displayName,
        });

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new Exception($"Register failed with {response.StatusCode}: {errorBody}");
        }

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetGuid();
    }

    /// <summary>
    /// Plays the part of the verification link: mints a token for the account
    /// and posts it to the same endpoint the email link points at.
    /// </summary>
    public static async Task<string> VerifyAsync(
        DevFlowWebApplicationFactory factory,
        HttpClient client,
        Guid userId)
    {
        using var scope = factory.Services.CreateScope();
        var tokenProvider = scope.ServiceProvider
            .GetRequiredService<IEmailVerificationTokenProvider>();

        var response = await client.PostAsJsonAsync("/api/v1/auth/verify-email", new
        {
            token = tokenProvider.Generate(userId),
        });

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new Exception(
                $"Verify failed with {response.StatusCode}: {errorBody}");
        }

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("accessToken").GetString()!;
    }

    /// <summary>Registers, verifies, and points the client at the new session.</summary>
    public static async Task<string> AuthenticateAsync(
        DevFlowWebApplicationFactory factory,
        HttpClient client,
        string displayName)
    {
        var email = $"user_{Guid.NewGuid():N}@test.io";
        var username = $"u_{Guid.NewGuid():N}"[..10];
        var password = "Sup3rSecret!";

        var userId = await RegisterAsync(client, email, username, password, displayName);
        var accessToken = await VerifyAsync(factory, client, userId);

        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        return accessToken;
    }
}
