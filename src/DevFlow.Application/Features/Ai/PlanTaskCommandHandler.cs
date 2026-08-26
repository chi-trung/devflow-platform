using System.Text;
using System.Text.Json;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Ai;

/// <summary>
/// Builds a knowledge-grounded prompt from the task + the project's weighted
/// KnowledgeEntries, calls the LLM, parses the JSON plan contract, and persists
/// it. When the project has self-approval enabled (ApproveAiPlans), the plan is
/// applied immediately instead of returned as pending.
/// </summary>
public sealed class PlanTaskCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IKnowledgeRepository knowledgeRepository,
    IAiPlanRepository aiPlanRepository,
    IAiClient aiClient,
    AiPlanApplier planApplier,
    IUserContext currentUser,
    IUnitOfWork unitOfWork) : IRequestHandler<PlanTaskCommand, AiPlanResponse>
{
    private const int MaxKnowledgeEntries = 12;
    private const int MaxKnowledgeBodyChars = 800;

    public async Task<AiPlanResponse> Handle(
        PlanTaskCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        var knowledge = await knowledgeRepository.GetForProjectAsync(command.ProjectId, cancellationToken);

        var (systemPrompt, userContext) = BuildPrompts(project, task, knowledge);

        string? rawResponse;
        try
        {
            rawResponse = await aiClient.PlanTaskAsync(systemPrompt, userContext, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            // The provider client surfaces API/auth errors as InvalidOperationException
            // with the real message (e.g. a 401). Map to the friendly 503 while
            // keeping the detail so the user knows why.
            throw new AiPlanningUnavailableException(ex.Message, ex);
        }

        if (string.IsNullOrWhiteSpace(rawResponse))
        {
            // The NoOpAiClient (no key configured) returns null.
            throw new AiPlanningUnavailableException(
                "The AI planner is not configured. Add an Ai:ApiKey + Ai:Model to enable AI planning.");
        }

        var contract = AiPlanContract.Parse(rawResponse);

        if (!contract.Subtasks.Any() && !contract.Steps.Any())
        {
            throw new AiPlanningUnavailableException(
                "The AI returned an empty plan. Try again or adjust the task description.");
        }

        // Supersede any previous pending plans for this task so only the newest
        // pending plan can be applied.
        var previousPlans = await aiPlanRepository.GetPendingForTaskAsync(command.TaskId, cancellationToken);
        foreach (var previous in previousPlans)
        {
            previous.MarkSuperseded();
        }

        var plan = AiPlan.Create(
            command.ProjectId,
            command.TaskId,
            currentUser.UserId,
            command.WorkspaceId,
            contract.Summary,
            JsonSerializer.Serialize(contract.Steps),
            JsonSerializer.Serialize(contract.Subtasks.Select(
                s => new { s.Title, s.Description, s.Priority })),
            JsonSerializer.Serialize(contract.DefinitionOfDone));

        await aiPlanRepository.AddAsync(plan, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        if (project.ApproveAiPlans)
        {
            await planApplier.ApplyAsync(project, task, plan, contract, cancellationToken);
            return BuildResponse(plan, applied: true);
        }

        return BuildResponse(plan, applied: false);
    }

    private static (string SystemPrompt, string UserContext) BuildPrompts(
        Project project,
        TaskItem task,
        IReadOnlyList<KnowledgeEntry> knowledge)
    {
        var systemPrompt = """
            You are DevFlow's planning agent. You break a work item down into a
            concrete, reviewable plan grounded in the project's knowledge base.

            Respond with a single JSON object and nothing else. Use exactly this shape:
            {
              "summary": "one short sentence describing the approach",
              "steps": ["step 1", "step 2"],
              "subtasks": [
                { "title": "...", "description": "...", "priority": "Low|Medium|High|Critical" }
              ],
              "definitionOfDone": ["criterion 1", "criterion 2"]
            }

            Rules:
            - 2–6 subtasks is ideal. Each must be independently actionable.
            - Priorities must be one of Low, Medium, High, Critical.
            - Definition of done must be concrete, testable acceptance criteria.
            - Ground the plan in the provided knowledge entries; do not contradict
              accepted ADRs. Lower-weight entries are less authoritative.
            - The plan must be complete enough that a developer could execute it
              without asking for clarification.
            """;

        var userContext = new StringBuilder();
        userContext.AppendLine($"Project: {project.Name}");
        userContext.AppendLine($"Task: {task.Title}");
        userContext.AppendLine($"Description: {task.Description ?? "(none)"}");
        userContext.AppendLine($"Status: {task.Status}");
        userContext.AppendLine($"Priority: {task.Priority}");
        userContext.AppendLine();

        if (knowledge.Count == 0)
        {
            userContext.AppendLine("Knowledge base: (empty)");
        }
        else
        {
            userContext.AppendLine($"Knowledge base (weighted, highest first):");
            foreach (var entry in knowledge.Take(MaxKnowledgeEntries))
            {
                var body = entry.Body;
                if (body is not null && body.Length > MaxKnowledgeBodyChars)
                {
                    body = body[..MaxKnowledgeBodyChars] + "…";
                }

                userContext.AppendLine($"- [{entry.Type}] {entry.Title} (weight {entry.Weight}, {entry.Status})");
                if (!string.IsNullOrWhiteSpace(body))
                {
                    userContext.AppendLine($"  {body}");
                }
            }
        }

        return (systemPrompt, userContext.ToString());
    }

    private static AiPlanResponse BuildResponse(AiPlan plan, bool applied)
    {
        var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var subtasks = JsonSerializer.Deserialize<List<AiPlanSubtaskContract>>(
                plan.SubtasksJson, jsonOptions)
            ?? new List<AiPlanSubtaskContract>();
        var steps = JsonSerializer.Deserialize<List<string>>(plan.StepsJson, jsonOptions)
            ?? new List<string>();
        var doD = JsonSerializer.Deserialize<List<string>>(plan.DefinitionOfDoneJson, jsonOptions)
            ?? new List<string>();

        return new AiPlanResponse(
            plan.Id,
            plan.TaskId,
            plan.ProjectId,
            plan.Status.ToString(),
            applied,
            plan.Summary,
            steps,
            subtasks.Select(s => new AiPlanSubtaskResponse(s.Title, s.Description, s.Priority)).ToList(),
            doD,
            plan.CreatedAtUtc);
    }
}
