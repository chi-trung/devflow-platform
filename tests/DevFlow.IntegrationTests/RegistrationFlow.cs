using System.Net.Http.Json;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;

namespace DevFlow.IntegrationTests;

/// <summary>
/// The register → sign-in sequence every authenticated integration test has to
/// walk, gathered in one place so the flow is changed once.
///
/// There is no verification step any more. Registration does not collect an
/// address, so there is nothing to prove and no inbox to click a link in; an
/// account is usable the moment it exists. <see cref="AuthenticateAsync"/>
/// therefore signs in over HTTP with the username rather than minting a token
/// and posting it, which exercises the real password path instead of
/// short-circuiting around it.
/// </summary>
internal static class RegistrationFlow
{
    /// <summary>
    /// Registers an account and returns its id. The account is usable
    /// immediately — there is no verify step to call.
    /// </summary>
    public static async Task<Guid> RegisterAsync(
        HttpClient client,
        string username,
        string password,
        string displayName)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
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
    /// Signs in with a username. Not the address — registration no longer
    /// collects one, so the username is the only identifier an account has.
    /// </summary>
    public static async Task<string> LoginAsync(
        HttpClient client,
        string username,
        string password)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            username,
            password,
        });

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new Exception($"Login failed with {response.StatusCode}: {errorBody}");
        }

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("accessToken").GetString()!;
    }

    /// <summary>Registers, signs in, and points the client at the new session.</summary>
    public static async Task<string> AuthenticateAsync(
        DevFlowWebApplicationFactory factory,
        HttpClient client,
        string displayName)
    {
        var username = $"u_{Guid.NewGuid():N}"[..10];
        var password = "Sup3rSecret!";

        await RegisterAsync(client, username, password, displayName);
        var accessToken = await LoginAsync(client, username, password);

        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        return accessToken;
    }
}
