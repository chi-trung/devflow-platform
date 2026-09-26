namespace DevFlow.Infrastructure.Email;

/// <summary>
/// A composed message, ready to hand to whatever transport delivers it.
/// </summary>
public readonly record struct ComposedEmail(string Subject, string Html);

/// <summary>
/// Builds the subject and HTML body of every DevFlow email, independent of who
/// sends it.
///
/// This exists so the wording of a message has exactly one home. Resend and
/// SMTP are two transports for the same ten emails: with the copy living in
/// each sender, a wording fix — or a newly hardened escape — would have to be
/// made twice, and the two providers would slowly drift apart in a way nobody
/// notices until a recipient gets the wrong one. Composing here and only
/// delivering there keeps the transport interchangeable.
///
/// Note the escaped values: task titles, comment bodies and workspace names are
/// attacker-controllable and every one of them lands in outbound email. A task
/// titled <c>&lt;img src=x onerror=…&gt;</c> would otherwise execute script in
/// the recipient's mail client, from a sender they already trust.
/// </summary>
public sealed class EmailComposer(string appUrl)
{
    private readonly string _appUrl = appUrl;

    /// <summary>
    /// Base URL of the web app, exposed so a sender can build the deep links
    /// (task, sprint, workspace) that the composed bodies point at.
    /// </summary>
    public string AppUrl => _appUrl;

    private static string Heading(string text) =>
        $"<h1 style=\"margin:0 0 14px;font-size:20px;line-height:28px;font-weight:700;color:#0f172a;\">{EmailLayout.Encode(text)}</h1>";

    private static string Paragraph(string html) =>
        $"<p style=\"margin:0 0 14px;\">{html}</p>";

    private static string Strong(string? value) =>
        $"<strong style=\"color:#0f172a;\">{EmailLayout.Encode(value)}</strong>";

    public ComposedEmail EmailVerification(string displayName, string verificationUrl) =>
        new(
            "Verify your DevFlow email address",
            EmailLayout.Render(
                preheader: $"Confirm your address to finish setting up your {Strong(displayName)} account.",
                body: string.Join(
                    string.Empty,
                    Heading($"Welcome, {displayName}"),
                    Paragraph(
                        "Confirm this address to activate your DevFlow account. " +
                        "It takes one click and keeps other people from signing up with your address."),
                    Paragraph(
                        "<span style=\"color:#64748b;\">This link works for 24 hours. " +
                        "If you did not create a DevFlow account, you can ignore this email.</span>")),
                actionUrl: verificationUrl,
                actionLabel: "Verify my email",
                appUrl: _appUrl));

    public ComposedEmail PasswordReset(string displayName, string resetUrl) =>
        new(
            "Reset your DevFlow password",
            EmailLayout.Render(
                preheader: $"A password reset was requested for your {Strong(displayName)} account.",
                body: string.Join(
                    string.Empty,
                    Heading("Reset your password"),
                    Paragraph(
                        "Someone asked to reset the password for this account. " +
                        "If it was you, choose a new one with the button below."),
                    Paragraph(
                        "<span style=\"color:#64748b;\">The link works once and expires in 30 minutes. " +
                        "If you did not ask for this, nothing has changed and you can ignore this email — " +
                        "but it is worth checking your password.</span>")),
                actionUrl: resetUrl,
                actionLabel: "Choose a new password",
                appUrl: _appUrl));

    public ComposedEmail TaskAssigned(
        string taskTitle, string projectName, string assignedBy, string taskUrl) =>
        new(
            $"New task assigned to you — {taskTitle}",
            EmailLayout.Render(
                preheader: $"{assignedBy} assigned you {taskTitle}.",
                body: string.Join(
                    string.Empty,
                    Heading("A task was assigned to you"),
                    Paragraph($"{Strong(assignedBy)} assigned you {Strong(taskTitle)} in project {Strong(projectName)}.")),
                taskUrl, "Open task", _appUrl));

    public ComposedEmail Mention(
        string taskTitle, string comment, string mentionedBy, string taskUrl) =>
        new(
            $"You were mentioned in a comment — {taskTitle}",
            EmailLayout.Render(
                preheader: $"{mentionedBy} mentioned you on {taskTitle}.",
                body: string.Join(
                    string.Empty,
                    Heading("You were mentioned"),
                    Paragraph($"{Strong(mentionedBy)} mentioned you in a comment on {Strong(taskTitle)}:"),
                    EmailLayout.QuoteStart + EmailLayout.Encode(comment) + EmailLayout.QuoteEnd),
                taskUrl, "Read the comment", _appUrl));

    public ComposedEmail SprintStarted(
        string sprintName, string projectName, string sprintUrl) =>
        new(
            $"Sprint started — {sprintName}",
            EmailLayout.Render(
                preheader: $"Sprint {sprintName} has started.",
                body: string.Join(
                    string.Empty,
                    Heading("A sprint just started"),
                    Paragraph($"Sprint {Strong(sprintName)} has started in project {Strong(projectName)}. Time to move some work across.")),
                sprintUrl, "Open sprint board", _appUrl));

    public ComposedEmail TaskStatusChanged(
        string taskTitle, string projectName, string newStatus, string changedBy, string taskUrl) =>
        new(
            $"Task status changed — {taskTitle}",
            EmailLayout.Render(
                preheader: $"{taskTitle} is now {newStatus}.",
                body: string.Join(
                    string.Empty,
                    Heading("Task status changed"),
                    Paragraph($"{Strong(changedBy)} moved {Strong(taskTitle)} to {Strong(newStatus)} in project {Strong(projectName)}.")),
                taskUrl, "View the change", _appUrl));

    public ComposedEmail CommentAdded(
        string taskTitle, string projectName, string comment, string commenterName, string taskUrl) =>
        new(
            $"New comment on {taskTitle}",
            EmailLayout.Render(
                preheader: $"{commenterName} commented on {taskTitle}.",
                body: string.Join(
                    string.Empty,
                    Heading("New comment"),
                    Paragraph($"{Strong(commenterName)} commented on {Strong(taskTitle)} in project {Strong(projectName)}:"),
                    EmailLayout.QuoteStart + EmailLayout.Encode(comment) + EmailLayout.QuoteEnd),
                taskUrl, "Read the comment", _appUrl));

    public ComposedEmail RoleChanged(
        string workspaceName, string newRole, string changedBy, string workspaceUrl) =>
        new(
            $"Your role changed in {workspaceName}",
            EmailLayout.Render(
                preheader: $"Your role in {workspaceName} is now {newRole}.",
                body: string.Join(
                    string.Empty,
                    Heading("Your role changed"),
                    Paragraph($"{Strong(changedBy)} changed your role in workspace {Strong(workspaceName)} to {Strong(newRole)}.")),
                workspaceUrl, "Open workspace", _appUrl));

    public ComposedEmail RemovedFromWorkspace(
        string workspaceName, string removedBy, string workspaceUrl) =>
        new(
            $"You were removed from {workspaceName}",
            EmailLayout.Render(
                preheader: $"You were removed from {workspaceName}.",
                body: string.Join(
                    string.Empty,
                    Heading("You were removed from a workspace"),
                    Paragraph($"{Strong(removedBy)} removed you from workspace {Strong(workspaceName)}. You no longer have access to its projects and tasks.")),
                workspaceUrl, "Sign in", _appUrl));

    public ComposedEmail WorkspaceInvite(
        string workspaceName, string invitedBy, string role, string workspaceUrl) =>
        new(
            $"You're invited to join {workspaceName}",
            EmailLayout.Render(
                preheader: $"{invitedBy} invited you to join {workspaceName}.",
                body: string.Join(
                    string.Empty,
                    Heading("You're invited to a workspace"),
                    Paragraph($"{Strong(invitedBy)} invited you to join {Strong(workspaceName)} as {Strong(role)}."),
                    Paragraph("Sign in to DevFlow and accept the invitation to start collaborating.")),
                workspaceUrl, "View the invitation", _appUrl));
}
