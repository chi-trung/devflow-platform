using Microsoft.Extensions.Configuration;

namespace DevFlow.Infrastructure.Email;

/// <summary>
/// Everything needed to open an SMTP session, read once from configuration.
///
/// The username is not necessarily the from-address — with a Gmail app
/// password it is always the mailbox, but a provider that authenticates a
/// dedicated sender keeps the two separate — so both are configurable and the
/// mailbox address is only a fallback.
/// </summary>
public sealed class SmtpOptions
{
    public const string DefaultHost = "smtp.gmail.com";

    public const int DefaultPort = 587;

    public const string DefaultFromName = "DevFlow";

    public string Host { get; init; } = DefaultHost;

    public int Port { get; init; } = DefaultPort;

    public string Username { get; init; } = string.Empty;

    /// <summary>
    /// Never logged and never rendered. Registered as a singleton built from
    /// configuration, so it exists for the process lifetime — long enough that
    /// an accidental <c>ToString()</c> in a log line would leak it.
    /// </summary>
    public string Password { get; init; } = string.Empty;

    public string FromEmail { get; init; } = string.Empty;

    public string FromName { get; init; } = DefaultFromName;

    /// <summary>
    /// Local part for the Message-ID domain, so a mail trace can be tied back
    /// to a deployment.
    /// </summary>
    public string MessageIdPrefix { get; init; } = "devflow";

    /// <summary>
    /// Require STARTTLS. On by default, and the reason this provider is safe
    /// at all: the password is a long-lived account credential, so it must
    /// never cross the wire in the clear. Turn it off only for a local server
    /// with no TLS to offer — a public relay will refuse an unencrypted AUTH
    /// anyway, and if one did not, the credential would be exposed.
    /// </summary>
    public bool UseStartTls { get; init; } = true;

    /// <summary>
    /// True when both halves of a credential are present, which is the only
    /// thing that makes this service selectable at all. An anonymous SMTP relay
    /// is a spam cannon, so there is deliberately no "no auth" path: an
    /// unauthenticated config falls through to the log service instead.
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Username) && !string.IsNullOrWhiteSpace(Password);

    /// <summary>
    /// Reports a half-configured SMTP setup. A username without a password (or
    /// the reverse) is the one way this transport can be selected by accident
    /// and then fail every send with an auth error nobody sees, because the
    /// sends are fire-and-forget.
    /// </summary>
    public static IReadOnlyList<string> FindMissingConfiguration(IConfiguration configuration)
    {
        var missing = new List<string>();

        var hasUser = !string.IsNullOrWhiteSpace(configuration["SMTP_USERNAME"]);
        var hasPassword = !string.IsNullOrWhiteSpace(configuration["SMTP_PASSWORD"]);

        if (!hasUser && !hasPassword)
        {
            return missing;
        }

        if (!hasUser)
        {
            missing.Add("SMTP_USERNAME (SMTP_PASSWORD is set, so SMTP will never be used)");
        }

        if (!hasPassword)
        {
            missing.Add("SMTP_PASSWORD (SMTP_USERNAME is set, so SMTP will never be used)");
        }

        if (string.IsNullOrWhiteSpace(configuration["SMTP_FROM_EMAIL"]))
        {
            missing.Add("SMTP_FROM_EMAIL (falls back to the SMTP_USERNAME mailbox)");
        }

        return missing;
    }

    public static SmtpOptions FromConfiguration(IConfiguration configuration)
    {
        var username = configuration["SMTP_USERNAME"]?.Trim() ?? string.Empty;
        var fromEmail = configuration["SMTP_FROM_EMAIL"]?.Trim();

        return new SmtpOptions
        {
            Host = configuration["SMTP_HOST"]?.Trim() is { Length: > 0 } host
                ? host
                : DefaultHost,
            Port = int.TryParse(configuration["SMTP_PORT"], out var port) && port > 0
                ? port
                : DefaultPort,
            Username = username,
            Password = configuration["SMTP_PASSWORD"] ?? string.Empty,
            // The mailbox is the only address known to be deliverable when the
            // sender is a personal account — which is the whole point of this
            // transport — so it is the fallback rather than a blank.
            FromEmail = !string.IsNullOrWhiteSpace(fromEmail) ? fromEmail : username,
            FromName = configuration["SMTP_FROM_NAME"] is { Length: > 0 } name
                ? name
                : DefaultFromName,
            MessageIdPrefix = configuration["SMTP_MESSAGE_ID_PREFIX"] is { Length: > 0 } prefix
                ? prefix
                : "devflow",
            // Anything other than an explicit false keeps encryption on, so a
            // typo cannot silently downgrade the connection.
            UseStartTls = !bool.TryParse(configuration["SMTP_USE_STARTTLS"], out var useTls) || useTls,
        };
    }
}
