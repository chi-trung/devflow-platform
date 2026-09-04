using DevFlow.Api.Auth;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace DevFlow.UnitTests.Features.Pat;

/// <summary>
/// Exercises PatAuthenticationHandler through its public
/// IAuthenticationHandler surface — the handler is the gate that makes stored
/// PATs actually usable as API credentials.
/// </summary>
public class PatAuthenticationHandlerTests
{
    private readonly IPersonalAccessTokenRepository _patRepository = Substitute.For<IPersonalAccessTokenRepository>();

    private static async Task<AuthenticateResult> AuthenticateAsync(
        IPersonalAccessTokenRepository repository,
        string? authorizationHeader)
    {
        var context = new DefaultHttpContext();
        if (authorizationHeader is not null)
        {
            context.Request.Headers.Authorization = authorizationHeader;
        }

        var handler = new PatAuthenticationHandler(
            repository,
            new OptionsMonitorStub<PatAuthenticationOptions>(new PatAuthenticationOptions()),
            NullLoggerFactory.Instance,
            UrlEncoder.Default);

        var scheme = new AuthenticationScheme(
            PatAuthenticationHandler.SchemeName,
            PatAuthenticationHandler.SchemeName,
            typeof(PatAuthenticationHandler));
        await handler.InitializeAsync(scheme, context);
        return await handler.AuthenticateAsync();
    }

    private static string RawToken() =>
        "df_" + Convert.ToHexString(new byte[48]).ToLowerInvariant();

    /// <summary>Same hash shape CreatePatCommandHandler stores: SHA-256 hex, lowercase.</summary>
    private static string HashToken(string token)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    [Fact]
    public async Task ValidActiveToken_ShouldAuthenticateWithSubAndScopes()
    {
        var userId = Guid.NewGuid();
        var raw = RawToken();
        var token = PersonalAccessToken.Create(
            userId, "CLI", HashToken(raw),
            new[] { "read", "write" }, DateTimeOffset.UtcNow.AddDays(30));
        _patRepository.GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(token);

        var result = await AuthenticateAsync(_patRepository, $"Bearer {raw}");

        Assert.True(result.Succeeded);
        Assert.Equal(PatAuthenticationHandler.SchemeName, result.Ticket?.AuthenticationScheme);
        var principal = result.Principal!;
        Assert.Equal(userId.ToString(), principal.FindFirstValue("sub"));
        Assert.Equal("read write", principal.FindFirstValue(PatAuthenticationHandler.ScopesClaim));
        Assert.True(principal.Identity?.IsAuthenticated);
        // Usage is stamped so the settings page can show last-used time.
        await _patRepository.Received(1).TouchLastUsedAsync(token.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UnknownToken_ShouldFail()
    {
        _patRepository.GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((PersonalAccessToken?)null);

        var result = await AuthenticateAsync(_patRepository, $"Bearer {RawToken()}");

        Assert.False(result.Succeeded);
        Assert.True(result.Failure is not null);
    }

    [Fact]
    public async Task RevokedToken_ShouldFail()
    {
        var raw = RawToken();
        var token = PersonalAccessToken.Create(
            Guid.NewGuid(), "Old", HashToken(raw),
            new[] { "read" }, DateTimeOffset.UtcNow.AddDays(30));
        token.Revoke(DateTimeOffset.UtcNow);
        _patRepository.GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(token);

        var result = await AuthenticateAsync(_patRepository, $"Bearer {raw}");

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task ExpiredToken_ShouldFail()
    {
        var raw = RawToken();
        var token = PersonalAccessToken.Create(
            Guid.NewGuid(), "Stale", HashToken(raw),
            new[] { "read" }, DateTimeOffset.UtcNow.AddDays(30));
        // Age the token past expiry without relying on wall-clock jitter.
        typeof(PersonalAccessToken)
            .GetProperty(nameof(PersonalAccessToken.ExpiresAtUtc))!
            .SetValue(token, DateTimeOffset.UtcNow.AddMinutes(-1));
        _patRepository.GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(token);

        var result = await AuthenticateAsync(_patRepository, $"Bearer {raw}");

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task NonPatBearer_ShouldReturnNoResult()
    {
        // JWTs and hub tickets belong to their own schemes — the PAT handler
        // must not claim them.
        var result = await AuthenticateAsync(_patRepository, "Bearer eyJhbGciOiJIUzI1NiJ9.abc");

        Assert.False(result.Succeeded);
        Assert.Null(result.Ticket);
        Assert.Null(result.Failure);
        await _patRepository.DidNotReceive().GetByTokenHashAsync(
            Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task MissingAuthorizationHeader_ShouldReturnNoResult()
    {
        var result = await AuthenticateAsync(_patRepository, null);

        Assert.Null(result.Ticket);
        await _patRepository.DidNotReceive().GetByTokenHashAsync(
            Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TouchFailure_ShouldNotFailAuthentication()
    {
        var userId = Guid.NewGuid();
        var raw = RawToken();
        var token = PersonalAccessToken.Create(
            userId, "CLI", HashToken(raw),
            new[] { "read" }, DateTimeOffset.UtcNow.AddDays(30));
        _patRepository.GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(token);
        _patRepository.TouchLastUsedAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("db down")));

        var result = await AuthenticateAsync(_patRepository, $"Bearer {raw}");

        // The token already proved itself — a failed usage stamp must not
        // turn a valid credential into a 401.
        Assert.True(result.Succeeded);
    }

    private sealed class OptionsMonitorStub<T>(T value) : IOptionsMonitor<T> where T : class
    {
        public T CurrentValue => value;
        public T Get(string? name) => value;
        public IDisposable? OnChange(Action<T, string?> listener) => null;
    }
}
