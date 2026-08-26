namespace DevFlow.Infrastructure.AI;

/// <summary>
/// Configuration for the AI planner. Provider-agnostic: any provider with an
/// OpenAI-compatible chat-completions endpoint works (OpenAI, Anthropic via a
/// proxy, LiteLLM, Ollama, ...) because <see cref="BaseUrl"/> is configurable.
/// </summary>
public sealed class AiOptions
{
    public const string SectionName = "Ai";

    /// <summary>"openai" (chat/completions shape) or "anthropic" (messages shape).</summary>
    public string Provider { get; init; } = "openai";

    public string ApiKey { get; init; } = string.Empty;

    /// <summary>Base URL of the chat endpoint, e.g. https://api.openai.com/v1.</summary>
    public string BaseUrl { get; init; } = "https://api.openai.com/v1";

    public string Model { get; init; } = string.Empty;

    /// <summary>Maximum response tokens for a plan.</summary>
    public int MaxTokens { get; init; } = 2000;
}
