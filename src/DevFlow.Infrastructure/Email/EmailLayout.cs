using System.Net;

namespace DevFlow.Infrastructure.Email;

/// <summary>
/// Shared HTML shell for every DevFlow email.
///
/// Mail clients are not browsers: Gmail and Outlook strip <c>&lt;style&gt;</c>
/// blocks, ignore most CSS, and disagree about everything else. So the layout
/// is a table-based skeleton with every declaration inlined and the brand
/// accent written as a literal hex — no CSS custom properties, no classes.
///
/// Single-quoted raw interpolation (<c>$"""</c>) is used throughout: the CSS
/// here contains no braces, so every <c>{Token}</c> is a real interpolation.
/// </summary>
internal static class EmailLayout
{
    private const string Ink = "#0f172a";
    private const string Muted = "#64748b";
    private const string Border = "#e2e8f0";
    private const string Surface = "#f8fafc";
    private const string Accent = "#0d9488";
    private const string AccentText = "#ffffff";

    /// <summary>Opens a quoted block (a comment body, for example).</summary>
    public const string QuoteStart =
        "<blockquote style=\"margin:16px 0;padding:2px 0 2px 14px;border-left:3px solid #0d9488;color:#475569;\">";

    public const string QuoteEnd = "</blockquote>";

    /// <summary>
    /// Wraps <paramref name="body"/> in the full branded shell.
    /// </summary>
    /// <param name="preheader">Shown in the inbox list before the message is
    /// opened. Visually hidden, but deliberately not <c>display:none</c> —
    /// clients that honour that drop it from the preview instead.</param>
    /// <param name="body">Trusted markup authored in this assembly. Every
    /// user-supplied string inside it must go through <see cref="Encode"/>.</param>
    /// <param name="actionUrl">CTA target, or null for a message with no action.</param>
    public static string Render(
        string preheader,
        string body,
        string? actionUrl,
        string actionLabel,
        string appUrl)
    {
        var hasAction = !string.IsNullOrWhiteSpace(actionUrl);

        var button = hasAction
            ? $"""
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 4px;">
                <tr><td align="center" style="border-radius:8px;background:{Accent};">
                  <a href="{Attribute(actionUrl)}" style="display:inline-block;padding:13px 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:{AccentText};text-decoration:none;border-radius:8px;">
                    {Text(actionLabel)}
                  </a>
                </td></tr>
              </table>
              """
            : string.Empty;

        // The fallback link is what keeps the message usable when a client
        // strips the button background or a security product quarantines the
        // whole email. Without it the recipient has nothing to click.
        var fallback = hasAction
            ? $"""
              <p style="margin:20px 0 0;font-size:12px;line-height:18px;color:{Muted};word-break:break-all;">
                Button not working? Paste this link into your browser:<br />
                <a href="{Attribute(actionUrl)}" style="color:{Accent};">{Text(actionUrl)}</a>
              </p>
              """
            : string.Empty;

        return $"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1" />
              <title>DevFlow</title>
            </head>
            <body style="margin:0;padding:0;background:{Surface};">
              <div style="font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{Text(preheader)}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{Surface};padding:32px 16px;">
                <tr><td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid {Border};border-radius:12px;">
                    <tr>
                      <td style="padding:22px 32px;border-bottom:1px solid {Border};">
                        <span style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.2px;color:{Ink};">Dev<span style="color:{Accent};">Flow</span></span>
                        <span style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:{Muted};margin-left:10px;">plan · build · review · ship</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:30px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:{Ink};">
                        {body}
                        {button}
                        {fallback}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:18px 32px;border-top:1px solid {Border};background:{Surface};font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:{Muted};">
                        Sent by DevFlow. This is an automated message — replies are not monitored.<br />
                        <a href="{Attribute(appUrl)}" style="color:{Muted};text-decoration:underline;">Open DevFlow</a>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
    }

    /// <summary>
    /// Escapes a string for interpolation into element content.
    ///
    /// This is not cosmetic. Task titles, comment bodies and workspace names
    /// are all attacker-controllable and every one of them lands in outbound
    /// email — a task titled <c>&lt;img src=x onerror=…&gt;</c> would otherwise
    /// execute script in the recipient's mail client, from a sender they
    /// already trust.
    /// </summary>
    public static string Encode(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

    /// <summary>Escapes a string for use inside a double-quoted attribute.</summary>
    public static string Attribute(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

    private static string Text(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);
}
