using DevFlow.Application.Features.Recurring;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/recurring-rules")]
public sealed class RecurringRulesController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<RecurringRuleResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        var rules = await sender.Send(
            new Application.Features.Recurring.List.ListRecurringRulesQuery(workspaceId, projectId),
            cancellationToken);
        return Ok(rules);
    }

    [HttpPost]
    [ProducesResponseType(typeof(RecurringRuleResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        Guid projectId,
        CreateRecurringRuleRequest request,
        CancellationToken cancellationToken)
    {
        var rule = await sender.Send(
            new Application.Features.Recurring.Create.CreateRecurringRuleCommand(
                workspaceId,
                projectId,
                request.Title,
                request.Description,
                request.Priority,
                request.Frequency,
                request.Interval,
                request.FirstDueDateUtc,
                request.SeedTaskId),
            cancellationToken);

        return CreatedAtAction(nameof(List), new { workspaceId, projectId }, rule);
    }

    [HttpPut("{ruleId:guid}")]
    [ProducesResponseType(typeof(RecurringRuleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid workspaceId,
        Guid projectId,
        Guid ruleId,
        UpdateRecurringRuleRequest request,
        CancellationToken cancellationToken)
    {
        var rule = await sender.Send(
            new Application.Features.Recurring.Update.UpdateRecurringRuleCommand(
                workspaceId,
                projectId,
                ruleId,
                request.Title,
                request.Description,
                request.Priority,
                request.Frequency,
                request.Interval,
                request.FirstDueDateUtc,
                request.IsActive),
            cancellationToken);

        return Ok(rule);
    }

    [HttpDelete("{ruleId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid workspaceId,
        Guid projectId,
        Guid ruleId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Recurring.Delete.DeleteRecurringRuleCommand(
                workspaceId, projectId, ruleId),
            cancellationToken);

        return NoContent();
    }
}

public sealed record CreateRecurringRuleRequest(
    string Title,
    string? Description,
    Domain.Enums.TaskItemPriority Priority,
    Domain.Enums.RecurrenceFrequency Frequency,
    int Interval,
    DateTimeOffset FirstDueDateUtc,
    Guid? SeedTaskId = null);

public sealed record UpdateRecurringRuleRequest(
    string Title,
    string? Description,
    Domain.Enums.TaskItemPriority Priority,
    Domain.Enums.RecurrenceFrequency Frequency,
    int Interval,
    DateTimeOffset FirstDueDateUtc,
    bool IsActive);
