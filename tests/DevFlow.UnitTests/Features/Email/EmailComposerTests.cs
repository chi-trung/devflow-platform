using DevFlow.Infrastructure.Email;
using Microsoft.Extensions.Configuration;

namespace DevFlow.UnitTests.Features.Email;

/// <summary>
/// The composer is the single home for every message's wording, so the
/// transports (Resend, SMTP) stay interchangeable. Two properties are worth
/// pinning here rather than at either transport: the shared bodies are
/// identical, and attacker-controlled strings arrive escaped.
/// </summary>
public class EmailComposerTests
{
    private static readonly EmailComposer Composer = new("https://app.devflow.io");

    [Fact]
    public void EmailVerification_ShouldCarryTheLinkAndTheSubject()
    {
        var message = Composer.EmailVerification("Dev", "https://app.devflow.io/verify-email?token=abc");

        Assert.Equal("Verify your DevFlow email address", message.Subject);
        Assert.Contains("https://app.devflow.io/verify-email?token=abc", message.Html);

        // The layout's whole fallback path exists for clients that strip the
        // button, so a message with no action URL has to keep that promise.
        Assert.Contains("Paste this link into your browser", message.Html);
    }

    [Fact]
    public void PasswordReset_ShouldStateSingleUseAndExpiry()
    {
        var message = Composer.PasswordReset("Dev", "https://app.devflow.io/reset-password?token=xyz");

        Assert.Equal("Reset your DevFlow password", message.Subject);

        // The recipient decides whether to act on the warning at the bottom of
        // this mail based on these two facts. Dropping either would make a
        // real compromise indistinguishable from a real request.
        Assert.Contains("works once", message.Html);
        Assert.Contains("30 minutes", message.Html);
    }

    /// <summary>
    /// Task titles, comment bodies and workspace names are all supplied by
    /// whoever can edit them, and every one of them lands in outbound email.
    /// A title of "&lt;img src=x onerror=…&gt;" must arrive as text — otherwise
    /// it runs in the recipient's mail client, from a sender they trust.
    /// </summary>
    [Fact]
    public void CommentAdded_ShouldEncodeUserSuppliedText()
    {
        var message = Composer.CommentAdded(
            taskTitle: "<script>alert('title')</script>",
            projectName: "Project",
            comment: "<img src=x onerror=alert('body')>",
            commenterName: "Mallory",
            taskUrl: "https://app.devflow.io/w/p/board");

        var html = message.Html;

        // The layout has no <img> or <script> of its own, so any real tag of
        // either kind could only have come from the user. A bare "onerror="
        // substring is not a useful check: it survives harmlessly inside an
        // escaped string — it never opens a tag.
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<img", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("</script", html, StringComparison.OrdinalIgnoreCase);

        // ...and the payload is still readable, which is the point of encoding
        // rather than stripping.
        Assert.Contains("&lt;script&gt;alert(&#39;title&#39;)&lt;/script&gt;", html);
        Assert.Contains("&lt;img src=x onerror=alert(&#39;body&#39;)&gt;", html);
    }

    [Fact]
    public void WorkspaceInvite_ShouldLinkToTheWorkspace()
    {
        var message = Composer.WorkspaceInvite(
            workspaceName: "DevFlow Workspace",
            invitedBy: "Bob",
            role: "Admin",
            workspaceUrl: "https://app.devflow.io/workspaces/workspace-123");

        Assert.Contains("https://app.devflow.io/workspaces/workspace-123", message.Html);
        Assert.Contains("Bob", message.Html);
        Assert.Contains("Admin", message.Html);
    }

    [Fact]
    public void EveryMessage_ShouldShareTheAppFooter()
    {
        // The footer link is composed once, so a change to it must reach all
        // ten messages — which is only true if each body goes through the same
        // layout. Spot-checked on three; a wording change is not per-message.
        var messages = new[]
        {
            Composer.EmailVerification("D", "https://app/verify-email?token=1"),
            Composer.TaskStatusChanged("T", "P", "Done", "B", "https://app/t"),
            Composer.RemovedFromWorkspace("W", "B", "https://app/w"),
        };

        foreach (var message in messages)
        {
            Assert.Contains("https://app.devflow.io", message.Html);
            Assert.StartsWith("<!DOCTYPE html>", message.Html, StringComparison.Ordinal);
        }
    }
}

public class SmtpOptionsTests
{
    private static IConfiguration Build(params (string Key, string Value)[] pairs) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(
                pairs.Select(p => new KeyValuePair<string, string?>(p.Key, p.Value)))
            .Build();

    /// <summary>
    /// An unauthenticated relay is a spam cannon, so there is deliberately no
    /// such path — a config with no credentials must simply not select SMTP.
    /// </summary>
    [Fact]
    public void IsConfigured_ShouldBeFalse_WhenEitherHalfIsMissing()
    {
        Assert.False(SmtpOptions.FromConfiguration(Build()).IsConfigured);
        Assert.False(SmtpOptions.FromConfiguration(Build(("SMTP_USERNAME", "a@b.com"))).IsConfigured);
        Assert.False(SmtpOptions.FromConfiguration(Build(("SMTP_PASSWORD", "secret"))).IsConfigured);

        Assert.True(SmtpOptions.FromConfiguration(
            Build(("SMTP_USERNAME", "a@b.com"), ("SMTP_PASSWORD", "secret"))).IsConfigured);
    }

    [Fact]
    public void FromConfiguration_ShouldDefaultToGmailSubmissionPort()
    {
        var options = SmtpOptions.FromConfiguration(
            Build(("SMTP_USERNAME", "devflow@gmail.com"), ("SMTP_PASSWORD", "abcd efgh ijkl mnop")));

        Assert.Equal("smtp.gmail.com", options.Host);
        Assert.Equal(587, options.Port);
        Assert.Equal("DevFlow", options.FromName);
    }

    [Fact]
    public void FromConfiguration_ShouldFallBackToTheMailboxAsSender()
    {
        // A personal mailbox is the only address known to be deliverable in the
        // case this transport exists for, so it is the fallback rather than a
        // blank that every send would fail on.
        var options = SmtpOptions.FromConfiguration(
            Build(("SMTP_USERNAME", "devflow@gmail.com"), ("SMTP_PASSWORD", "secret")));

        Assert.Equal("devflow@gmail.com", options.FromEmail);
    }

    [Fact]
    public void FromConfiguration_ShouldHonourAnExplicitSenderAndPort()
    {
        var options = SmtpOptions.FromConfiguration(Build(
            ("SMTP_USERNAME", "apikey"),
            ("SMTP_PASSWORD", "secret"),
            ("SMTP_FROM_EMAIL", "noreply@devflow.com"),
            ("SMTP_FROM_NAME", "DevFlow"),
            ("SMTP_HOST", "smtp.proton.me"),
            ("SMTP_PORT", "465")));

        Assert.Equal("noreply@devflow.com", options.FromEmail);
        Assert.Equal("smtp.proton.me", options.Host);
        Assert.Equal(465, options.Port);
    }

    /// <summary>
    /// A credential that is half present is the one way SMTP gets configured
    /// without being selected, and then every send degrades silently to the
    /// log. The boot warning is the only place that surfaces.
    /// </summary>
    [Fact]
    public void FindMissingConfiguration_ShouldNameTheHalfThatIsAbsent()
    {
        Assert.Empty(SmtpOptions.FindMissingConfiguration(Build()));

        var userOnly = SmtpOptions.FindMissingConfiguration(Build(("SMTP_USERNAME", "a@b.com")));
        Assert.Contains(userOnly, m => m.Contains("SMTP_PASSWORD"));

        var passwordOnly = SmtpOptions.FindMissingConfiguration(Build(("SMTP_PASSWORD", "s")));
        Assert.Contains(passwordOnly, m => m.Contains("SMTP_USERNAME"));

        Assert.Empty(SmtpOptions.FindMissingConfiguration(
            Build(("SMTP_USERNAME", "a@b.com"), ("SMTP_PASSWORD", "s"), ("SMTP_FROM_EMAIL", "a@b.com"))));
    }
}
