using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace DevFlow.Infrastructure.Email;

/// <summary>
/// Assembles the link that goes in the email body:
/// <c>{FRONTEND_URL}/verify-email?token=…</c>
///
/// FRONTEND_URL is the load-bearing part. If it is missing or still points at
/// localhost on a real deployment, the link is syntactically fine and silently
/// useless — the recipient clicks and lands nowhere. That failure is invisible
/// from the response, so it is logged loudly at startup rather than left for
/// someone to discover by testing.
/// </summary>
public sealed class EmailVerificationLinkBuilder(
    IEmailVerificationTokenProvider tokenProvider,
    IConfiguration configuration) : IEmailVerificationLinkBuilder
{
    private const string VerifyPath = "/verify-email";

    private const string DefaultFrontendUrl = "http://localhost:5173";

    private string FrontendUrl =>
        (configuration["FRONTEND_URL"] ?? DefaultFrontendUrl).TrimEnd('/');

    public string Build(Guid userId)
    {
        var token = tokenProvider.Generate(userId);
        return $"{FrontendUrl}{VerifyPath}?token={Uri.EscapeDataString(token)}";
    }

    /// <summary>
    /// Names the email-related variables that are absent, so a misconfigured
    /// deploy says so in the log instead of quietly producing dead links.
    /// </summary>
    public static IReadOnlyList<string> FindMissingConfiguration(IConfiguration configuration)
    {
        var missing = new List<string>();

        // Resend's key is the preferred provider, but its absence is only a
        // problem when nothing else can send — otherwise warning about it on
        // every boot of a deliberately SMTP-configured deployment trains people
        // to ignore this log entirely, which is the one thing it exists to stop.
        if (string.IsNullOrWhiteSpace(configuration["RESEND_API_KEY"])
            && !SmtpOptions.FromConfiguration(configuration).IsConfigured)
        {
            missing.Add("RESEND_API_KEY and SMTP_USERNAME/SMTP_PASSWORD (verification links will be logged, not sent)");
        }

        if (!string.IsNullOrWhiteSpace(configuration["RESEND_API_KEY"])
            && string.IsNullOrWhiteSpace(configuration["RESEND_FROM_EMAIL"]))
        {
            missing.Add("RESEND_FROM_EMAIL (falls back to onboarding@resend.dev)");
        }

        // A half-configured SMTP setup is the failure this catches: one half of
        // the credential present means the service is never selected, and every
        // send silently degrades to the log.
        missing.AddRange(SmtpOptions.FindMissingConfiguration(configuration));

        var frontendUrl = configuration["FRONTEND_URL"];
        if (string.IsNullOrWhiteSpace(frontendUrl))
        {
            missing.Add($"FRONTEND_URL (links will point at {DefaultFrontendUrl})");
        }

        return missing;
    }
}
