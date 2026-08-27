using System.Globalization;
using System.Text;
using System.Text.Json;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Epics.Create;
using DevFlow.Application.Features.Projects.Create;
using DevFlow.Application.Features.Sprints.AssignTask;
using DevFlow.Application.Features.Sprints.Create;
using DevFlow.Application.Features.Tasks.Create;
using DevFlow.Application.Features.Tasks.Subtasks;
using DevFlow.Application.Features.Tasks.Update;
using DevFlow.Application.Features.Workspaces.Create;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Ai.Execute;

/// <summary>
/// The AI assistant dispatcher. Builds a prompt from the user's words plus the
/// current workspace context (projects, sprints, members), asks the LLM to pick
/// concrete actions, then executes each one through the existing MediatR
/// commands. Every action is wrapped in its own try/catch so one failure (e.g.
/// the caller is not an Admin for create_project) never cancels the rest.
/// </summary>
public sealed class AiExecuteCommandHandler(
    IWorkspaceRepository workspaceRepository,
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    ITaskItemRepository taskItemRepository,
    IEpicRepository epicRepository,
    IUserRepository userRepository,
    IAiClient aiClient,
    ISender sender,
    IUnitOfWork unitOfWork) : IRequestHandler<AiExecuteCommand, AiExecuteResponse>
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

        var actions = new List<ExecutedAction>(contract.Actions.Count);
        foreach (var action in contract.Actions)
        {
            ExecutedAction result;
            try
            {
                result = await ExecuteActionAsync(command.WorkspaceId, command.ProjectId, action, cancellationToken);
            }
            catch (ForbiddenAccessException)
            {
                result = Fail(action, "You do not have permission to perform this action.");
            }
            catch (NotFoundException ex)
            {
                result = Fail(action, ex.Message);
            }
            catch (Exception ex)
            {
                result = Fail(action, ex.Message);
            }

            actions.Add(result);
        }

        return new AiExecuteResponse(contract.Summary, actions, null);
    }

    private async Task<ExecutedAction> ExecuteActionAsync(
        Guid workspaceId,
        Guid? projectId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        switch (action.Type.Trim().ToLowerInvariant())
        {
            case "create_workspace":
                return await CreateWorkspaceAsync(workspaceId, action, cancellationToken);

            case "create_project":
                return await CreateProjectAsync(workspaceId, projectId, action, cancellationToken);

            case "create_task":
                return await CreateTaskAsync(workspaceId, projectId, action, cancellationToken);

            case "create_subtask":
                return await CreateSubtaskAsync(workspaceId, projectId, action, cancellationToken);

            case "create_sprint":
                return await CreateSprintAsync(workspaceId, projectId, action, cancellationToken);

            case "create_epic":
                return await CreateEpicAsync(workspaceId, projectId, action, cancellationToken);

            case "set_due_date":
            case "set_priority":
            case "assign_task":
                return await UpdateTaskAsync(workspaceId, projectId, action, cancellationToken);

            case "assign_to_sprint":
                return await AssignToSprintAsync(workspaceId, projectId, action, cancellationToken);

            case "add_to_epic":
                return await AddToEpicAsync(workspaceId, projectId, action, cancellationToken);

            default:
                return new ExecutedAction(action.Type, action.Title ?? action.Type, null, "skipped",
                    $"Unknown action type \"{action.Type}\".");
        }
    }

    private async Task<ExecutedAction> CreateWorkspaceAsync(
        Guid workspaceId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        var name = RequireTitle(action);
        var slug = ToSlug(name);
        var workspaceIdResult = await sender.Send(
            new CreateWorkspaceCommand(name, slug, action.Description),
            cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(action, "create_workspace", workspaceIdResult, $"Workspace \"{name}\" created.");
    }

    private async Task<ExecutedAction> CreateProjectAsync(
        Guid workspaceId,
        Guid? projectId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        var name = RequireTitle(action);
        var key = ToProjectKey(name);
        var projectIdResult = await sender.Send(
            new CreateProjectCommand(workspaceId, name, key, action.Description),
            cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(action, "create_project", projectIdResult, $"Project \"{name}\" created.");
    }

    private async Task<ExecutedAction> CreateTaskAsync(
        Guid workspaceId,
        Guid? projectId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        var project = await ResolveProjectAsync(workspaceId, projectId, action.ProjectRef, cancellationToken);
        var priority = ToPriority(action.Priority);
        var dueDate = ToDueDate(action.DueDate);

        var taskIdResult = await sender.Send(
            new CreateTaskItemCommand(
                workspaceId,
                project.Id,
                RequireTitle(action),
                action.Description,
                priority,
                dueDate),
            cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(action, "create_task", taskIdResult.Id, $"Task \"{action.Title}\" created.");
    }

    private async Task<ExecutedAction> CreateSubtaskAsync(
        Guid workspaceId,
        Guid? projectId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        var project = await ResolveProjectAsync(workspaceId, projectId, action.ProjectRef, cancellationToken);
        var parent = await ResolveTaskAsync(workspaceId, project.Id, action.ParentTaskRef, cancellationToken);

        var response = await sender.Send(
            new CreateSubtaskCommand(
                workspaceId,
                project.Id,
                parent.Id,
                RequireTitle(action),
                action.Description,
                ToPriority(action.Priority)),
            cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(action, "create_subtask", response.Id, $"Subtask \"{action.Title}\" created under \"{parent.Title}\".");
    }

    private async Task<ExecutedAction> CreateSprintAsync(
        Guid workspaceId,
        Guid? projectId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        var project = await ResolveProjectAsync(workspaceId, projectId, action.ProjectRef, cancellationToken);

        var response = await sender.Send(
            new CreateSprintCommand(
                workspaceId,
                project.Id,
                RequireTitle(action),
                action.Description),
            cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(action, "create_sprint", response.Id, $"Sprint \"{action.Title}\" created.");
    }

    private async Task<ExecutedAction> CreateEpicAsync(
        Guid workspaceId,
        Guid? projectId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        var project = await ResolveProjectAsync(workspaceId, projectId, action.ProjectRef, cancellationToken);

        var response = await sender.Send(
            new CreateEpicCommand(
                workspaceId,
                project.Id,
                RequireTitle(action),
                action.Description,
                null,
                null,
                null),
            cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(action, "create_epic", response.Id, $"Epic \"{action.Title}\" created.");
    }

    private async Task<ExecutedAction> UpdateTaskAsync(
        Guid workspaceId,
        Guid? projectId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        var project = await ResolveProjectAsync(workspaceId, projectId, action.ProjectRef, cancellationToken);
        var task = await ResolveTaskAsync(workspaceId, project.Id, action.TaskRef ?? action.Title, cancellationToken);

        // Read the current values first so partial updates (only a due date, only
        // a priority, only an assignee) do not clobber the other fields.
        var assigneeId = action.Type == "assign_task"
            ? await ResolveAssigneeAsync(workspaceId, action.Assignee, cancellationToken)
            : task.AssigneeId;
        var dueDate = action.Type == "set_due_date"
            ? ToDueDate(action.DueDate)
            : task.DueDateUtc;
        var priority = action.Type == "set_priority"
            ? ToPriority(action.Priority)
            : task.Priority;

        await sender.Send(
            new UpdateTaskItemCommand(
                workspaceId,
                project.Id,
                task.Id,
                task.Title,
                task.Description,
                task.Status,
                priority,
                assigneeId,
                dueDate),
            cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        var message = action.Type switch
        {
            "set_due_date" => $"Due date for \"{task.Title}\" set.",
            "set_priority" => $"Priority for \"{task.Title}\" set to {priority}.",
            _ => $"Task \"{task.Title}\" assigned.",
        };

        return Ok(action, action.Type, task.Id, message);
    }

    private async Task<ExecutedAction> AssignToSprintAsync(
        Guid workspaceId,
        Guid? projectId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        var project = await ResolveProjectAsync(workspaceId, projectId, action.ProjectRef, cancellationToken);
        var task = await ResolveTaskAsync(workspaceId, project.Id, action.TaskRef ?? action.Title, cancellationToken);
        var sprint = await ResolveSprintAsync(project.Id, action.SprintRef ?? action.Title, cancellationToken);

        await sender.Send(
            new AssignTaskToSprintCommand(workspaceId, project.Id, sprint.Id, task.Id),
            cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(action, "assign_to_sprint", task.Id, $"Task \"{task.Title}\" moved to sprint \"{sprint.Name}\".");
    }

    private async Task<ExecutedAction> AddToEpicAsync(
        Guid workspaceId,
        Guid? projectId,
        AiExecuteActionContract action,
        CancellationToken cancellationToken)
    {
        var project = await ResolveProjectAsync(workspaceId, projectId, action.ProjectRef, cancellationToken);
        var task = await ResolveTaskAsync(workspaceId, project.Id, action.TaskRef ?? action.Title, cancellationToken);
        var epic = await ResolveEpicAsync(project.Id, action.EpicRef ?? action.Title, cancellationToken);

        // Attach the task to the epic directly (mirrors the subtask handler):
        // there is no dedicated "move to epic" command, and the task's EpicId is
        // a plain FK on the aggregate.
        task.AttachToEpic(epic.Id);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(action, "add_to_epic", task.Id, $"Task \"{task.Title}\" added to epic \"{epic.Name}\".");
    }

    // ----- Name resolution helpers -------------------------------------------------

    private Project ResolveProjectOrDefault(IReadOnlyList<Project> projects, string? projectRef)
    {
        if (!string.IsNullOrWhiteSpace(projectRef))
        {
            var byName = projects.FirstOrDefault(p =>
                p.Name.Contains(projectRef, StringComparison.OrdinalIgnoreCase));
            if (byName is not null)
            {
                return byName;
            }
        }

        // Fall back to the first project in the workspace so a bare prompt like
        // "create task X" works without naming a project.
        return projects[0];
    }

    private async Task<Project> ResolveProjectAsync(
        Guid workspaceId,
        Guid? projectId,
        string? projectRef,
        CancellationToken cancellationToken)
    {
        var projects = await projectRepository.GetForWorkspaceAsync(workspaceId, cancellationToken);

        if (projectId.HasValue)
        {
            var explicitProject = projects.FirstOrDefault(p => p.Id == projectId.Value);
            if (explicitProject is not null)
            {
                return explicitProject;
            }
        }

        if (projects.Count == 0)
        {
            throw new NotFoundException(nameof(Project), "no project in this workspace");
        }

        return ResolveProjectOrDefault(projects, projectRef);
    }

    private async Task<TaskItem> ResolveTaskAsync(
        Guid workspaceId,
        Guid projectId,
        string? taskRef,
        CancellationToken cancellationToken)
    {
        if (Guid.TryParse(taskRef, out var taskId))
        {
            var byId = await taskItemRepository.GetByIdAsync(taskId, cancellationToken);
            if (byId is not null && byId.ProjectId == projectId)
            {
                return byId;
            }
        }

        var tasks = await taskItemRepository.GetForProjectAsync(projectId, null, cancellationToken);

        if (!string.IsNullOrWhiteSpace(taskRef))
        {
            var byTitle = tasks.FirstOrDefault(t =>
                t.Title.Contains(taskRef, StringComparison.OrdinalIgnoreCase));
            if (byTitle is not null)
            {
                return byTitle;
            }
        }

        throw new NotFoundException(nameof(TaskItem), taskRef ?? "(unnamed)");
    }

    private async Task<Sprint> ResolveSprintAsync(
        Guid projectId,
        string? sprintRef,
        CancellationToken cancellationToken)
    {
        var sprints = await sprintRepository.GetForProjectAsync(projectId, cancellationToken);

        if (Guid.TryParse(sprintRef, out var sprintId))
        {
            var byId = sprints.FirstOrDefault(s => s.Id == sprintId);
            if (byId is not null)
            {
                return byId;
            }
        }

        if (!string.IsNullOrWhiteSpace(sprintRef))
        {
            var byName = sprints.FirstOrDefault(s =>
                s.Name.Contains(sprintRef, StringComparison.OrdinalIgnoreCase));
            if (byName is not null)
            {
                return byName;
            }
        }

        throw new NotFoundException(nameof(Sprint), sprintRef ?? "(unnamed)");
    }

    private async Task<Epic> ResolveEpicAsync(
        Guid projectId,
        string? epicRef,
        CancellationToken cancellationToken)
    {
        var epics = await epicRepository.GetForProjectAsync(projectId, cancellationToken);

        if (Guid.TryParse(epicRef, out var epicId))
        {
            var byId = epics.FirstOrDefault(e => e.Id == epicId);
            if (byId is not null)
            {
                return byId;
            }
        }

        if (!string.IsNullOrWhiteSpace(epicRef))
        {
            var byName = epics.FirstOrDefault(e =>
                e.Name.Contains(epicRef, StringComparison.OrdinalIgnoreCase));
            if (byName is not null)
            {
                return byName;
            }
        }

        throw new NotFoundException(nameof(Epic), epicRef ?? "(unnamed)");
    }

    private async Task<Guid?> ResolveAssigneeAsync(
        Guid workspaceId,
        string? assigneeRef,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(assigneeRef))
        {
            return null;
        }

        if (Guid.TryParse(assigneeRef, out var assigneeId))
        {
            var byId = await userRepository.GetByIdAsync(assigneeId, cancellationToken);
            if (byId is not null)
            {
                return byId.Id;
            }
        }

        var members = await workspaceRepository.GetMembersAsync(workspaceId, cancellationToken);

        // Match display name, username, or email (case-insensitive, substring).
        var member = members.FirstOrDefault(m =>
            m.DisplayName.Contains(assigneeRef, StringComparison.OrdinalIgnoreCase)
            || m.Username.Contains(assigneeRef, StringComparison.OrdinalIgnoreCase)
            || m.Email.Contains(assigneeRef, StringComparison.OrdinalIgnoreCase));

        return member.UserId;
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
                var sprint = task.SprintId is not null
                    ? $" | sprint={task.SprintId}"
                    : string.Empty;
                var epic = task.EpicId is not null
                    ? $" | epic={task.EpicId}"
                    : string.Empty;
                var assignee = task.AssigneeId is not null
                    ? $" | assignee={task.AssigneeId}"
                    : string.Empty;
                context.AppendLine($"- {task.Id} | {task.Title} | {task.Status}{sprint}{epic}{assignee}");
            }
        }

        return (systemPrompt, context.ToString());
    }

    // ----- Small helpers -------------------------------------------------------------

    private static string RequireTitle(AiExecuteActionContract action) =>
        string.IsNullOrWhiteSpace(action.Title)
            ? throw new InvalidOperationException("The action is missing a title.")
            : action.Title;

    private static TaskItemPriority ToPriority(string priority) =>
        Enum.TryParse<TaskItemPriority>(priority, ignoreCase: true, out var parsed)
            ? parsed
            : TaskItemPriority.Medium;

    private static DateTimeOffset? ToDueDate(string? dueDate)
    {
        if (string.IsNullOrWhiteSpace(dueDate))
        {
            return null;
        }

        if (DateTimeOffset.TryParse(dueDate, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return parsed;
        }

        if (DateOnly.TryParse(dueDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateOnly))
        {
            return new DateTimeOffset(dateOnly.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        }

        return null;
    }

    /// <summary>Turns an arbitrary display name into a workspace slug (lowercase, hyphens).</summary>
    private static string ToSlug(string name)
    {
        var slug = name.ToLowerInvariant().Trim();
        var builder = new StringBuilder(slug.Length);
        char? last = null;
        foreach (var c in slug)
        {
            if (char.IsLetterOrDigit(c))
            {
                builder.Append(c);
                last = c;
            }
            else if (last != '-')
            {
                builder.Append('-');
                last = '-';
            }
        }

        while (builder.Length > 0 && builder[^1] == '-')
        {
            builder.Length--;
        }

        return builder.Length == 0 ? "workspace" : builder.ToString();
    }

    /// <summary>Turns an entity name into a short project key (letters + digits).</summary>
    private static string ToProjectKey(string name)
    {
        var key = new string(name.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        if (key.Length == 0)
        {
            key = "PRJ";
        }
        else if (key.Length > 10)
        {
            key = key[..10];
        }

        if (!char.IsLetter(key[0]))
        {
            key = "P" + key;
        }

        return key;
    }

    private static ExecutedAction Ok(
        AiExecuteActionContract action,
        string type,
        Guid entityId,
        string message) =>
        new(type, action.Title ?? type, entityId, "success", message);

    private static ExecutedAction Fail(AiExecuteActionContract action, string message) =>
        new(action.Type, action.Title ?? action.Type, null, "failed", message);
}
