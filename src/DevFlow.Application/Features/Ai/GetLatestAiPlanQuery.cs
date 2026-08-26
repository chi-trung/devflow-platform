using System.Text.Json;
using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Ai;

/// <summary>Fetches the latest AI plan for a task (pending or applied).</summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetLatestAiPlanQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest<AiPlanResponse?>, IWorkspaceRequest;

public sealed class GetLatestAiPlanQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IAiPlanRepository aiPlanRepository) : IRequestHandler<GetLatestAiPlanQuery, AiPlanResponse?>
{
    public async Task<AiPlanResponse?> Handle(
        GetLatestAiPlanQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var task = await taskItemRepository.GetByIdAsync(query.TaskId, cancellationToken);

        if (task is null || task.ProjectId != query.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), query.TaskId);
        }

        var plan = await aiPlanRepository.GetLatestForTaskAsync(query.TaskId, cancellationToken);

        if (plan is null)
        {
            return null;
        }

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
            Applied: plan.Status == AiPlanStatus.Applied,
            plan.Summary,
            steps,
            subtasks.Select(s => new AiPlanSubtaskResponse(s.Title, s.Description, s.Priority)).ToList(),
            doD,
            plan.CreatedAtUtc);
    }
}
