using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace DevFlow.Infrastructure.Email;

/// <summary>
/// Assembles the link that goes in the reset email:
/// <c>{FRONTEND_URL}/reset-password?token=…</c>
///
/// Shares FRONTEND_URL with the verification builder for the same reason it
/// is load-bearing there: pointing at localhost in production produces a link
/// that looks fine and lands nowhere. <see cref="EmailVerificationLinkBuilder.FindMissingConfiguration"/>
/// already reports a missing FRONTEND_URL at startup, and this route inherits
/// that warning rather than duplicating it.
/// </summary>
public sealed class PasswordResetLinkBuilder(
    IConfiguration configuration) : IPasswordResetLinkBuilder
{
    private const string ResetPath = "/reset-password";

    private const string DefaultFrontendUrl = "http://localhost:5173";

    private string FrontendUrl =>
        (configuration["FRONTEND_URL"] ?? DefaultFrontendUrl).TrimEnd('/');

    public string Build(string token)
    {
        // Escaped because the token rides in a query string unencoded from the
        // mail client's point of view; a raw '&' or '#' would truncate it.
        return $"{FrontendUrl}{ResetPath}?token={Uri.EscapeDataString(token)}";
    }
}
