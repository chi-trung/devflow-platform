namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Provider-agnostic AI client. Every provider (OpenAI, Anthropic, LiteLLM, …)
/// resolves to a single <see cref="PlanTaskAsync"/> call that returns a
/// structured JSON plan or null on failure.
/// </summary>
public interface IAiClient
{
    /// <summary>
    /// Sends the system prompt + user context to the configured LLM and returns
    /// the raw response text. Returns null on any failure (network, auth, parse).
    /// </summary>
    Task<string?> PlanTaskAsync(string systemPrompt, string userContext, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a short prompt to the configured LLM to decide which app actions to
    /// execute (create task, set deadline, assign, …) and returns the raw JSON
    /// action list. Uses a tighter token budget and timeout than
    /// <see cref="PlanTaskAsync"/> so the assistant responds quickly.
    /// </summary>
    Task<string?> ExecuteActionAsync(string systemPrompt, string userContext, CancellationToken cancellationToken = default);
}