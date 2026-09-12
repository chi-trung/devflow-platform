using System.Text.Json;
using System.Text.Json.Nodes;
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
            // A model can return a JSON array or scalar at the root; AsObject()
            // would throw InvalidOperationException, so pattern-match instead.
            if (JsonNode.Parse(json) is not JsonObject root)
            {
                return new AiPlanContract();
            }

            return new AiPlanContract
            {
                Summary = GetString(root, "summary"),
                Steps = GetStringList(root, "steps"),
                Subtasks = GetSubtasks(root, "subtasks"),
                DefinitionOfDone = GetStringList(root, "definitionOfDone"),
            };
        }
        catch (JsonException)
        {
            // An LLM can return malformed JSON (extra prose, truncated output).
            // Fail soft — the caller turns the empty result into a friendly error.
            return new AiPlanContract();
        }
    }

    // The old deserializer ran with PropertyNameCaseInsensitive; keep matching
    // keys regardless of the model's casing ("definitionOfDone", "DefinitionOfDone").
    private static JsonNode? GetNode(JsonObject root, string name)
    {
        foreach (var property in root)
        {
            if (string.Equals(property.Key, name, StringComparison.OrdinalIgnoreCase))
            {
                return property.Value;
            }
        }

        return null;
    }

    private static string? GetString(JsonObject root, string name)
    {
        return GetNode(root, name) is JsonValue value && value.TryGetValue<string>(out var text)
            ? text
            : null;
    }

    private static List<string> GetStringList(JsonObject root, string name)
    {
        var result = new List<string>();
        if (GetNode(root, name) is not JsonArray array)
        {
            return result;
        }

        foreach (var item in array)
        {
            // Models occasionally wrap plain strings in objects; salvage the
            // first string-valued member instead of dropping the entry.
            var text = item switch
            {
                JsonValue value when value.TryGetValue<string>(out var s) => s,
                JsonObject obj => obj
                    .Select(p => p.Value)
                    .OfType<JsonValue>()
                    .FirstOrDefault(v => v.TryGetValue<string>(out _))?
                    .GetValue<string>(),
                _ => null,
            };

            if (!string.IsNullOrWhiteSpace(text))
            {
                result.Add(text.Trim());
            }
        }

        return result;
    }

    private static List<AiPlanSubtaskContract> GetSubtasks(JsonObject root, string name)
    {
        var result = new List<AiPlanSubtaskContract>();
        if (GetNode(root, name) is not JsonArray array)
        {
            return result;
        }

        foreach (var item in array)
        {
            var subtask = item switch
            {
                // Models sometimes return a bare string array for subtasks —
                // the string is the title.
                JsonValue value when value.TryGetValue<string>(out var s)
                    && !string.IsNullOrWhiteSpace(s) => new AiPlanSubtaskContract
                    {
                        Title = s.Trim(),
                    },
                JsonObject obj => new AiPlanSubtaskContract
                {
                    // Models drift from the exact key name ("name", "task",
                    // "label"); without this the title silently deserializes
                    // to empty and AiPlanApplier drops the subtask on Apply.
                    Title = (GetFirstString(obj, "title", "name", "task", "label") ?? string.Empty).Trim(),
                    Description = GetFirstString(obj, "description", "details", "detail"),
                    Priority = GetFirstString(obj, "priority") ?? "Medium",
                },
                _ => null,
            };

            if (subtask is not null && !string.IsNullOrWhiteSpace(subtask.Title))
            {
                result.Add(subtask);
            }
        }

        return result;
    }

    private static string? GetFirstString(JsonObject obj, params string[] names)
    {
        foreach (var name in names)
        {
            if (GetNode(obj, name) is JsonValue value && value.TryGetValue<string>(out var text)
                && !string.IsNullOrWhiteSpace(text))
            {
                return text;
            }
        }

        return null;
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
