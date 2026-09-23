using DevFlow.Domain.Entities;

namespace DevFlow.Application.Features.Tasks;

/// <summary>
/// Shared summary builders for <see cref="TaskItemResponse"/> — the list and
/// get-by-id handlers both enrich a task with attachment / PR summaries, and
/// the rules (image-only previews, case-insensitive PR statuses) must not
/// drift between the two.
/// </summary>
internal static class TaskSummaries
{
    /// <summary>
    /// Builds a card attachment summary: total count plus up to 3 image/*
    /// previews ({id, contentType}). Attachments are ordered newest-first
    /// (as returned by the repository).
    /// </summary>
    public static AttachmentSummary? BuildAttachmentSummary(IReadOnlyList<TaskAttachment>? attachments)
    {
        if (attachments is null || attachments.Count == 0)
        {
            return null;
        }

        var previews = attachments
            .Where(attachment => attachment.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            .Take(3)
            .Select(attachment => new AttachmentPreview(attachment.Id, attachment.ContentType))
            .ToList();

        return new AttachmentSummary(attachments.Count, previews);
    }

    /// <summary>
    /// Buckets a task's linked PRs by status for the card badge. Statuses are
    /// compared case-insensitively — legacy rows store lowercase "open" while
    /// the webhook and manual-add flows write "Open"/"Merged"/"Closed".
    /// </summary>
    public static PullRequestSummary? BuildPullRequestSummary(IReadOnlyList<PullRequest>? pullRequests)
    {
        if (pullRequests is null || pullRequests.Count == 0)
        {
            return null;
        }

        var open = pullRequests.Count(pr => "open".Equals(pr.Status, StringComparison.OrdinalIgnoreCase));
        var merged = pullRequests.Count(pr => "merged".Equals(pr.Status, StringComparison.OrdinalIgnoreCase));
        var closed = pullRequests.Count(pr => "closed".Equals(pr.Status, StringComparison.OrdinalIgnoreCase));

        return new PullRequestSummary(open, merged, closed);
    }
}
