using System.Text.Json;
using System.Text.Json.Serialization;

namespace DevFlow.Application.Features.Ai.Execute;

/// <summary>
/// Contract the AI model must return for <see cref="AiExecuteCommand"/>: a short
/// summary plus a list of typed actions to perform. Each action carries only the
/// fields its target command needs; the dispatcher resolves names (project,
/// sprint, assignee) against the current workspace before sending.
/// </summary>
public sealed class AiExecuteContract
{
    [JsonPropertyName("summary")]
    public string? Summary { get; set; }

    /// <summary>
    /// Conversational reply for prompts that are not action requests — a
    /// question, a greeting, small talk. When present, the assistant surfaces it
    /// as a plain text answer instead of trying to execute actions.
    /// </summary>
    [JsonPropertyName("reply")]
    public string? Reply { get; set; }

    [JsonPropertyName("actions")]
    public List<AiExecuteActionContract> Actions { get; set; } = new();

    public static AiExecuteContract Parse(string json)
    {
        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            };

            return JsonSerializer.Deserialize<AiExecuteContract>(json, options)
                ?? new AiExecuteContract();
        }
        catch (JsonException)
        {
            // An LLM can return malformed JSON (extra prose, truncated output).
            // Fail soft — the caller surfaces a friendly error.
            return new AiExecuteContract();
        }
    }
}

public sealed class AiExecuteActionContract
{
    /// <summary>
    /// One of: create_task, create_subtask, create_sprint, create_epic,
    /// create_project, create_workspace, set_due_date, set_priority,
    /// assign_task, assign_to_sprint.
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("priority")]
    public string Priority { get; set; } = "Medium";

    [JsonPropertyName("dueDate")]
    public string? DueDate { get; set; }

    /// <summary>Display-name or email of the member to assign a task to.</summary>
    [JsonPropertyName("assignee")]
    public string? Assignee { get; set; }

    /// <summary>Existing task reference: its id, or a title to search for.</summary>
    [JsonPropertyName("taskRef")]
    public string? TaskRef { get; set; }

    /// <summary>Existing parent task id or title for create_subtask.</summary>
    [JsonPropertyName("parentTaskRef")]
    public string? ParentTaskRef { get; set; }

    /// <summary>Existing project id or name; the active project is the default.</summary>
    [JsonPropertyName("projectRef")]
    public string? ProjectRef { get; set; }

    /// <summary>Existing sprint id or name (for assign_to_sprint).</summary>
    [JsonPropertyName("sprintRef")]
    public string? SprintRef { get; set; }
}
