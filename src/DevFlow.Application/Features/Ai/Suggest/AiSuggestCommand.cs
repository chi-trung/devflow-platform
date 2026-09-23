using DevFlow.Application.Common.Authorization;
using MediatR;

namespace DevFlow.Application.Features.Ai.Suggest;

/// <summary>
/// Suggests context-aware prompts based on real project data (current sprints,
/// epics, unassigned tasks, due dates, blockers…) and the page the user is on.
/// Returns i18n keys + interpolation params so the frontend renders suggestions
/// in the user's language. <paramref name="ExcludeKeys"/> holds recently picked
/// chip keys so the next open surfaces fresh prompts instead of the same set.
/// </summary>
public sealed record AiSuggestCommand(
    Guid WorkspaceId,
    Guid? ProjectId,
    string? PageContext,
    Guid? EpicId = null,
    IReadOnlyList<string>? ExcludeKeys = null) : IRequest<List<AiSuggestion>>, IWorkspaceRequest;

public sealed record AiSuggestion(
    string Key,
    Dictionary<string, string>? Args = null);
