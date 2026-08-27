namespace DevFlow.Infrastructure.AI;

/// <summary>
/// Configuration for the AI planner. Provider-agnostic: "openai" uses the
/// OpenAI chat-completions shape (works against OpenAI, Anthropic via a proxy,
/// LiteLLM, Ollama, ...), "gemini" uses the Google Generative Language API.
/// </summary>
public sealed class AiOptions
{
    public const string SectionName = "Ai";

    /// <summary>"openai" (chat/completions shape) or "gemini" (generateContent shape).</summary>
    public string Provider { get; init; } = "openai";

    public string ApiKey { get; init; } = string.Empty;

    /// <summary>
    /// For "openai": base URL of the chat endpoint, e.g. https://api.openai.com/v1.
    /// For "gemini": base URL of the Generative Language API, e.g.
    /// https://generativelanguage.googleapis.com/v1beta (the client's default).
    /// </summary>
    public string BaseUrl { get; init; } = string.Empty;

    /// <summary>
    /// Model id. For "openai" any provider model name; for "gemini" e.g.
    /// "gemini-2.0-flash" or "gemini-1.5-flash".
    /// </summary>
    public string Model { get; init; } = string.Empty;

    /// <summary>Maximum response tokens for a plan.</summary>
    public int MaxTokens { get; init; } = 2000;
}
