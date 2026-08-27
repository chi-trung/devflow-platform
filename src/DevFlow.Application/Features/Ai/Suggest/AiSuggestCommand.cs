using DevFlow.Application.Common.Authorization;
using MediatR;

namespace DevFlow.Application.Features.Ai.Suggest;

/// <summary>
/// Suggests context-aware prompts based on real project data (current sprints,
/// epics, unassigned tasks, etc.). Returns i18n keys + interpolation params so
/// the frontend renders suggestions in the user's language.
/// </summary>
public sealed record AiSuggestCommand(
    Guid WorkspaceId,
    Guid? ProjectId,
    string? PageContext,
    Guid? EpicId = null) : IRequest<List<AiSuggestion>>, IWorkspaceRequest;

public sealed record AiSuggestion(
    string Key,
    Dictionary<string, string>? Args = null);