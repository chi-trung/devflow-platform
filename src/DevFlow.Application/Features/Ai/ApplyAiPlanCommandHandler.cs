using System.Text.Json;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Ai;

/// <summary>
/// Applies a pending AI plan: creates subtasks under the parent task, sets the
/// task's Definition of Done, and marks the plan as Applied. The plan must be
/// Pending and belong to the specified project.
/// </summary>
public sealed class ApplyAiPlanCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IAiPlanRepository aiPlanRepository,
    AiPlanApplier planApplier) : IRequestHandler<ApplyAiPlanCommand, AiPlanResponse>
{
    public async Task<AiPlanResponse> Handle(
        ApplyAiPlanCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var plan = await aiPlanRepository.GetByIdAsync(command.PlanId, cancellationToken);

        if (plan is null || plan.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(AiPlan), command.PlanId);
        }

        if (plan.Status != Domain.Enums.AiPlanStatus.Pending)
        {
            throw new ConflictException(
                $"Plan '{plan.Id}' is {plan.Status} and cannot be applied.");
        }

        var task = await taskItemRepository.GetByIdAsync(plan.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), plan.TaskId);
        }

        var contract = new AiPlanContract
        {
            Summary = plan.Summary,
            Steps = JsonSerializer.Deserialize<List<string>>(plan.StepsJson) ?? new(),
            Subtasks = JsonSerializer.Deserialize<List<AiPlanSubtaskContract>>(plan.SubtasksJson) ?? new(),
            DefinitionOfDone = JsonSerializer.Deserialize<List<string>>(plan.DefinitionOfDoneJson) ?? new(),
        };

        // Supersede any other pending plans for this task.
        var otherPending = (await aiPlanRepository.GetPendingForTaskAsync(plan.TaskId, cancellationToken))
            .Where(p => p.Id != plan.Id);

        foreach (var other in otherPending)
        {
            other.MarkSuperseded();
        }

        await planApplier.ApplyAsync(project, task, plan, contract, cancellationToken);

        return BuildResponse(plan);
    }

    private static AiPlanResponse BuildResponse(AiPlan plan)
    {
        var subtasks = JsonSerializer.Deserialize<List<AiPlanSubtaskContract>>(plan.SubtasksJson)
            ?? new List<AiPlanSubtaskContract>();
        var steps = JsonSerializer.Deserialize<List<string>>(plan.StepsJson)
            ?? new List<string>();
        var doD = JsonSerializer.Deserialize<List<string>>(plan.DefinitionOfDoneJson)
            ?? new List<string>();

        return new AiPlanResponse(
            plan.Id,
            plan.TaskId,
            plan.ProjectId,
            plan.Status.ToString(),
            Applied: true,
            plan.Summary,
            steps,
            subtasks.Select(s => new AiPlanSubtaskResponse(s.Title, s.Description, s.Priority)).ToList(),
            doD,
            plan.CreatedAtUtc);
    }
}