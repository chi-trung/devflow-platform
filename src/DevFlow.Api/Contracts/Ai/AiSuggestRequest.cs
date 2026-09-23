namespace DevFlow.Api.Contracts.Ai;

/// <summary>
/// Body for POST …/ai/suggest. <paramref name="ExcludeKeys"/> is the ring of
/// chip keys the user already picked so the next open can demote them.
/// </summary>
public sealed record AiSuggestRequest(string? PageContext, string[]? ExcludeKeys);
