using System.Text.Json;
using System.Text.Json.Serialization;

namespace DevFlow.Application.Features.Ai;

/// <summary>
/// Contract the AI model must return for <see cref="PlanTaskCommand"/>: a JSON
/// object with a summary, ordered steps, proposed subtasks, and a Definition of
/// Done checklist. Kept minimal so any model/endpoint can satisfy it.
/// </summary>
public sealed class AiPlanContract
{
    [JsonPropertyName("summary")]
    public string? Summary { get; set; }

    [JsonPropertyName("steps")]
    public List<string> Steps { get; set; } = new();

    [JsonPropertyName("subtasks")]
    public List<AiPlanSubtaskContract> Subtasks { get; set; } = new();

    [JsonPropertyName("definitionOfDone")]
    public List<string> DefinitionOfDone { get; set; } = new();

    public static AiPlanContract Parse(string json)
    {
        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            };

            var contract = JsonSerializer.Deserialize<AiPlanContract>(json, options);

            return contract ?? new AiPlanContract();
        }
        catch (JsonException)
        {
            // An LLM can return malformed JSON (extra prose, truncated output).
            // Fail soft — the caller turns the empty result into a friendly error.
            return new AiPlanContract();
        }
    }
}

public sealed class AiPlanSubtaskContract
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("priority")]
    public string Priority { get; set; } = "Medium";
}
