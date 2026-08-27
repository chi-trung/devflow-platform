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
    IUserRepository userRepository,
    IAiClient aiClient,
    ISender sender,
    IUnitOfWork unitOfWork) : IRequestHandler<AiExecuteCommand, AiExecuteResponse>
{
    public async Task<AiExecuteResponse> Handle(
        AiExecuteCommand command,
        CancellationToken cancellationToken)
    {
        var (systemPrompt, userContext) = await BuildPromptsAsync(command, cancellationToken);

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

        if (string.IsNullOrWhiteSpace(rawResponse))
        {
            return new AiExecuteResponse(
                null,
                Array.Empty<ExecutedAction>(),
                "The AI assistant is not configured. Add an Ai:ApiKey + Ai:Model to enable it.");
        }

        var contract = AiExecuteContract.Parse(rawResponse);

        if (contract.Actions.Count == 0)
        {
            return new AiExecuteResponse(
                contract.Summary,
                Array.Empty<ExecutedAction>(),
                "The AI did not return any actions. Try rephrasing your request.");
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
        CancellationToken cancellationToken)
    {
        var systemPrompt = """
            You are DevFlow's AI assistant. You turn the user's request into a
            short list of concrete actions. Respond with a single JSON object and
            nothing else. Use exactly this shape:
            {
              "summary": "one short sentence describing what you did or will do",
              "actions": [
                {
                  "type": "create_task|create_subtask|create_sprint|create_epic|create_project|create_workspace|set_due_date|set_priority|assign_task|assign_to_sprint",
                  "title": "human-readable entity or task name",
                  "description": "optional",
                  "priority": "Low|Medium|High|Critical",
                  "dueDate": "ISO-8601 date like 2026-09-01 or full timestamp",
                  "assignee": "member display name or email (only for assign_task)",
                  "taskRef": "existing task id or a title substring to match (required for set_due_date, set_priority, assign_task, assign_to_sprint)",
                  "parentTaskRef": "existing task id or title substring (only for create_subtask)",
                  "projectRef": "existing project id or name; omit to use the active project (only for actions that need a project)",
                  "sprintRef": "existing sprint id or name (only for assign_to_sprint)"
                }
              ]
            }

            Rules:
            - Pick the fewest actions that satisfy the request. One action per logical change.
            - "title" for create_* actions is the new entity's name. For updates it is only informational.
            - For set_due_date / set_priority / assign_task / assign_to_sprint you MUST set taskRef to an existing task (id or title). Never invent an id; if no task matches, still emit the action and the system will report it as failed.
            - Assignee must be one of the member names/emails listed in the context, or null.
            - Priorities must be one of Low, Medium, High, Critical.
            - dueDate must be ISO-8601. If the user says "tomorrow"/"next week", pick a concrete date and note it in the summary.
            - Do not echo the user's prompt back. Only output the JSON.
            """;

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
            return (systemPrompt, context.ToString());
        }

        context.AppendLine("Projects in this workspace:");
        foreach (var project in projects)
        {
            context.AppendLine($"- {project.Id} | {project.Name}");
            var sprints = await sprintRepository.GetForProjectAsync(project.Id, cancellationToken);
            if (sprints.Count > 0)
            {
                context.AppendLine("  Sprints:");
                foreach (var sprint in sprints)
                {
                    context.AppendLine($"    - {sprint.Id} | {sprint.Name} ({sprint.Status})");
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
