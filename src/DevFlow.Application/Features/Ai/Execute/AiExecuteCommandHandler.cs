using System.Text;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Ai.Execute;

/// <summary>
/// The AI assistant dispatcher. Builds a prompt from the user's words plus the
/// current workspace context (projects, sprints, members), asks the LLM to pick
/// concrete actions, then presents them for review. create_* actions (task,
/// sprint, epic, project, workspace) are returned as "pending" — the user must
/// Accept them via the confirm endpoint before they run. Mutation actions on
/// existing data (set_due_date, set_priority, assign_task, assign_to_sprint,
/// add_to_epic) execute immediately. Every action is wrapped in its own
/// try/catch so one failure never cancels the rest.
/// </summary>
public sealed class AiExecuteCommandHandler(
    IWorkspaceRepository workspaceRepository,
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    ITaskItemRepository taskItemRepository,
    IEpicRepository epicRepository,
    IAiClient aiClient,
    AiActionExecutor actionExecutor) : IRequestHandler<AiExecuteCommand, AiExecuteResponse>
{
    private const string NoActionsMessage =
        "The AI did not return any actions. Try rephrasing your request.";

    public async Task<AiExecuteResponse> Handle(
        AiExecuteCommand command,
        CancellationToken cancellationToken)
    {
        var (systemPrompt, userContext) = await BuildPromptsAsync(command, cancellationToken, tight: false);

        var response = await ExecuteOnceAsync(command, systemPrompt, userContext, cancellationToken);

        if (response.Error == NoActionsMessage)
        {
            // The model either hit its output-token ceiling mid-JSON (truncated,
            // so no actions parsed) or genuinely returned an empty list. Re-prompt
            // once with a hard cap on the action count: a large batch request
            // ("create 12 tasks…") then yields a useful partial result instead of
            // an error. Never loop — one tight retry is enough.
            var (tightPrompt, tightContext) = await BuildPromptsAsync(command, cancellationToken, tight: true);
            response = await ExecuteOnceAsync(command, tightPrompt, tightContext, cancellationToken);
        }

        return response;
    }

    private async Task<AiExecuteResponse> ExecuteOnceAsync(
        AiExecuteCommand command,
        string systemPrompt,
        string userContext,
        CancellationToken cancellationToken)
    {
        string? rawResponse;
        try
        {
            rawResponse = await aiClient.ExecuteActionAsync(systemPrompt, userContext, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // The provider timed out (the client enforces its own per-request
            // budget). Return a friendly message instead of surfacing the
            // cancellation as a 500.
            return new AiExecuteResponse(
                null,
                Array.Empty<ExecutedAction>(),
                "AI request timed out. The model is busy right now — please try again.");
        }
        catch (InvalidOperationException ex)
        {
            // Provider-level failure (network, auth, 503 overload). Surface it as a
            // friendly message without a partial result.
            return new AiExecuteResponse(null, Array.Empty<ExecutedAction>(), ex.Message);
        }
        catch (AiResponseTruncatedException)
        {
            // The model hit its output-token ceiling mid-JSON. The caller
            // re-prompts with a tighter action cap instead of showing a
            // truncated response as "no actions".
            return new AiExecuteResponse(null, Array.Empty<ExecutedAction>(), NoActionsMessage);
        }

        if (string.IsNullOrWhiteSpace(rawResponse))
        {
            return new AiExecuteResponse(
                null,
                Array.Empty<ExecutedAction>(),
                "The AI assistant is not configured. Add an Ai:ApiKey + Ai:Model to enable it.");
        }

        var contract = AiExecuteContract.Parse(rawResponse);

        // Conversational prompt (question, greeting, small talk) — the model
        // returned a `reply` instead of action items. Surface it as a plain text
        // answer with no error.
        if (!string.IsNullOrWhiteSpace(contract.Reply))
        {
            return new AiExecuteResponse(contract.Reply, Array.Empty<ExecutedAction>(), null);
        }

        if (contract.Actions.Count == 0)
        {
            return new AiExecuteResponse(
                contract.Summary,
                Array.Empty<ExecutedAction>(),
                NoActionsMessage);
        }

        // Pre-pass: collect the titles of create_* actions. A mutation that
        // targets one of these (e.g. "assign the new task") must be deferred —
        // its target does not exist until the user accepts the create.
        var pendingTitles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var action in contract.Actions)
        {
            if (AiActionExecutor.IsCreateAction(action.Type) && !string.IsNullOrWhiteSpace(action.Title))
            {
                pendingTitles.Add(action.Title);
            }
        }

        var actions = new List<ExecutedAction>(contract.Actions.Count);
        foreach (var action in contract.Actions)
        {
            var type = action.Type.Trim().ToLowerInvariant();

            // create_* actions are never executed on the first pass — they are
            // proposed to the user ("pending") and only run once the user
            // Accepts them through the confirm endpoint.
            if (AiActionExecutor.IsCreateAction(type))
            {
                actions.Add(new ExecutedAction(
                    type,
                    action.Title ?? type,
                    null,
                    "pending",
                    $"Proposed \"{action.Title}\" — waiting for your approval.",
                    action));
                continue;
            }

            // A mutation that references a task the model also proposed to
            // create cannot run yet. Defer it alongside the create so both are
            // applied together when the user accepts.
            var targetRef = AiActionExecutor.TargetTaskRef(action);
            if (!string.IsNullOrWhiteSpace(targetRef) && pendingTitles.Contains(targetRef))
            {
                actions.Add(new ExecutedAction(
                    type,
                    action.Title ?? type,
                    null,
                    "pending",
                    $"Waiting for \"{targetRef}\" to be created first.",
                    action));
                continue;
            }

            ExecutedAction result;
            try
            {
                result = await actionExecutor.ExecuteActionAsync(
                    command.WorkspaceId,
                    command.ProjectId,
                    action,
                    cancellationToken);
            }
            catch (ForbiddenAccessException)
            {
                result = Fail(action, "You do not have permission to perform this action.");
            }
            catch (NotFoundException ex)
            {
                result = Fail(action, ex.Message);
            }
            catch (InvalidHierarchyException ex)
            {
                result = FailWithError(action, ex.Message,
                    new AiActionErrorDetail(
                        "hierarchy_violation",
                        ex.Message,
                        ex.ParentId,
                        ex.ActualParentType,
                        ex.RequiredParentType,
                        ex.RecoveryHint));
            }
            catch (Exception ex)
            {
                result = Fail(action, ex.Message);
            }

            actions.Add(result);
        }

        return new AiExecuteResponse(contract.Summary, actions, null);
    }

    // ----- Prompt building ----------------------------------------------------------

    private async Task<(string SystemPrompt, string UserContext)> BuildPromptsAsync(
        AiExecuteCommand command,
        CancellationToken cancellationToken,
        bool tight)
    {
        var systemPrompt = """
            You are DevFlow's AI assistant. You turn the user's request into a
            short list of concrete actions. Respond with a single JSON object and
            nothing else. Use exactly this shape:
            {
              "summary": "one short sentence describing what you did or will do",
              "reply": "optional plain-text answer when the user is NOT asking for an action",
              "actions": [
                {
                  "type": "create_task|create_subtask|create_sprint|create_epic|create_project|create_workspace|set_due_date|set_priority|assign_task|assign_to_sprint|add_to_epic",
                  "title": "human-readable entity or task name",
                  "description": "optional",
                  "priority": "Low|Medium|High|Critical",
                  "dueDate": "ISO-8601 date like 2026-09-01 or full timestamp",
                  "assignee": "member display name or email (only for assign_task)",
                  "taskRef": "existing task id or a title substring to match (required for set_due_date, set_priority, assign_task, assign_to_sprint)",
                  "parentTaskRef": "existing task id or title substring (only for create_subtask)",
                  "projectRef": "existing project id or name; omit to use the active project (only for actions that need a project)",
                  "sprintRef": "existing sprint id or name (only for assign_to_sprint)",
                  "epicRef": "existing epic id or name (only for add_to_epic)"
                }
              ]
            }

            Rules:
            - If the user asks a question, greets you, or makes small talk (e.g.
              "what models do you use?", "hello", "who are you?"), set "reply" to
              a short, friendly answer in the user's language and leave "actions"
              empty. Do not invent actions for a prompt that asks for none.
            - The context lists the projects, sprints, epics and tasks the user
              can see. Reference them by their real id or an exact title substring
              from that list. Never invent an id or a task title.
            - "this sprint" / "the current sprint" means the sprint marked as
              [CURRENT] in the context. "this epic" means the epic marked as
              [CURRENT]. "this project" means the project the current page belongs
              to (marked [ACTIVE]).
            - Otherwise pick the fewest actions that satisfy the request. One action per logical change.
            - "title" for create_* actions is the new entity's name. For updates it is only informational.
            - For set_due_date / set_priority / assign_task / assign_to_sprint / add_to_epic you MUST set taskRef to an existing task (id or title from the context). Never invent an id; if no task matches, still emit the action and the system will report it as failed.
            - For assign_to_sprint / add_to_epic you MUST set sprintRef / epicRef to an existing sprint or epic from the context.
            - Assignee must be one of the member names/emails listed in the context, or null.
            - Priorities must be one of Low, Medium, High, Critical.
            - dueDate must be ISO-8601. If the user says "tomorrow"/"next week", pick a concrete date and note it in the summary.

            HIERARCHY (mandatory):
            - The project hierarchy is EXACTLY three levels:
              Epic -> Task -> Subtask. A subtask can NEVER contain children.
            - Tasks appear in the context marked [TASK] (ParentTaskId = none) and
              subtasks marked [SUBTASK] (ParentTaskId = the id of their parent task).
              The context also lists each task's ParentTaskId.
            - For create_subtask, parentTaskRef MUST reference a [TASK] entry — a
              top-level task. NEVER use a [SUBTASK] as the parent. If the user
              asks to "add a subtask to" a [SUBTASK], create the subtask under
              that [SUBTASK]'s own top-level parent instead.
            - If a [TASK] and a [SUBTASK] share the same name, only the [TASK]
              can be a parent. Prefer referencing parents by id.
            - Do not invent a parent. If no [TASK] matches the user's request,
              create a top-level task first (create_task), then create the
              subtask under it.
            - Do not echo the user's prompt back. Only output the JSON.
            """;

        if (tight)
        {
            // Second pass: the first call produced no actions (usually because a
            // large batch request hit the output-token ceiling mid-JSON). Force a
            // small, complete action list that fits comfortably — the user gets a
            // partial result instead of an error, and can run a follow-up prompt
            // for the rest.
            systemPrompt += """
                IMPORTANT — output limit:
                - You MUST output at most 3 actions, and absolutely nothing else.
                - Prefer the 3 highest-priority changes that satisfy the request.
                - Keep every title short (5 words or fewer). No descriptions.
                - If the request lists more than 3 items, do the first 3 and say
                  "and N more could not fit" in the summary.
                """;
        }

        var context = new StringBuilder();
        context.AppendLine($"User request: {command.Prompt}");
        if (!string.IsNullOrWhiteSpace(command.PageContext))
        {
            context.AppendLine($"Current page context: {command.PageContext}");
        }

        context.AppendLine();

        var projects = await projectRepository.GetForWorkspaceAsync(command.WorkspaceId, cancellationToken);

        if (projects.Count == 0)
        {
            context.AppendLine("Projects in this workspace: (none)");
            context.AppendLine("Members in this workspace: (none known)");
            context.AppendLine("Sprints: (none)");
            context.AppendLine("Tasks: (none)");
            context.AppendLine("Epics: (none)");
            return (systemPrompt, context.ToString());
        }

        // The project the user is currently viewing, if any. Marked [ACTIVE] so
        // the model resolves "this project" / a bare task request to it.
        Project? activeProject = null;
        if (command.ProjectId is not null)
        {
            activeProject = projects.FirstOrDefault(p => p.Id == command.ProjectId.Value);
        }
        activeProject ??= projects[0];

        context.AppendLine("Projects in this workspace:");
        foreach (var project in projects)
        {
            var marker = project.Id == activeProject.Id ? " [ACTIVE]" : string.Empty;
            context.AppendLine($"- {project.Id} | {project.Name}{marker}");

            var sprints = await sprintRepository.GetForProjectAsync(project.Id, cancellationToken);
            if (sprints.Count > 0)
            {
                context.AppendLine("  Sprints:");
                foreach (var sprint in sprints)
                {
                    var sprintMarker = sprint.Id == command.SprintId
                        ? " [CURRENT]"
                        : string.Empty;
                    context.AppendLine($"    - {sprint.Id} | {sprint.Name} ({sprint.Status}){sprintMarker}");
                }
            }

            var epics = await epicRepository.GetForProjectAsync(project.Id, cancellationToken);
            if (epics.Count > 0)
            {
                context.AppendLine("  Epics:");
                foreach (var epic in epics)
                {
                    var epicMarker = epic.Id == command.EpicId
                        ? " [CURRENT]"
                        : string.Empty;
                    context.AppendLine($"    - {epic.Id} | {epic.Name}{epicMarker}");
                }
            }
        }

        context.AppendLine();
        context.AppendLine("Members in this workspace:");
        var members = await workspaceRepository.GetMembersAsync(command.WorkspaceId, cancellationToken);
        foreach (var member in members)
        {
            context.AppendLine($"- {member.UserId} | {member.DisplayName} | {member.Username} | {member.Email} ({member.Role})");
        }

        // Existing tasks of the active project — the model needs real titles/ids
        // to set refs (set_due_date, assign, add_to_epic, …) instead of guessing.
        var tasks = await taskItemRepository.GetForProjectAsync(activeProject.Id, status: null, cancellationToken);
        context.AppendLine();
        context.AppendLine($"Tasks in \"{activeProject.Name}\":");
        if (tasks.Count == 0)
        {
            context.AppendLine("(none)");
        }
        else
        {
            foreach (var task in tasks)
            {
                var isSubtask = task.ParentTaskId is not null;
                var typeMarker = isSubtask ? " [SUBTASK]" : " [TASK]";
                var parentRef = isSubtask
                    ? $" | parentTaskId={task.ParentTaskId}"
                    : string.Empty;
                var sprint = task.SprintId is not null
                    ? $" | sprint={task.SprintId}"
                    : string.Empty;
                var epic = task.EpicId is not null
                    ? $" | epic={task.EpicId}"
                    : string.Empty;
                var assignee = task.AssigneeId is not null
                    ? $" | assignee={task.AssigneeId}"
                    : string.Empty;
                context.AppendLine($"- {task.Id} | {task.Title} | {task.Status}{typeMarker}{parentRef}{sprint}{epic}{assignee}");
            }
        }

        return (systemPrompt, context.ToString());
    }

    private static ExecutedAction Fail(AiExecuteActionContract action, string message) =>
        new(action.Type, action.Title ?? action.Type, null, "failed", message);

    private static ExecutedAction FailWithError(
        AiExecuteActionContract action,
        string message,
        AiActionErrorDetail error) =>
        new(action.Type, action.Title ?? action.Type, null, "failed", message, Error: error);
}
