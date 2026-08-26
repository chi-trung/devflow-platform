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
}