using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/fields")]
public sealed class CustomFieldsController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(List<Application.Features.CustomFields.CustomFieldResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid workspaceId, Guid projectId, CancellationToken ct)
    {
        var result = await sender.Send(new Application.Features.CustomFields.ListCustomFieldsQuery(workspaceId, projectId), ct);
        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(Guid), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(Guid workspaceId, Guid projectId, CreateCustomFieldRequest request, CancellationToken ct)
    {
        var id = await sender.Send(new Application.Features.CustomFields.CreateCustomFieldCommand(
            workspaceId, projectId, request.Name, request.FieldType, request.Options, request.IsRequired), ct);
        return StatusCode(StatusCodes.Status201Created, id);
    }

    [HttpPut("{fieldId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Update(Guid workspaceId, Guid projectId, Guid fieldId, UpdateCustomFieldRequest request, CancellationToken ct)
    {
        await sender.Send(new Application.Features.CustomFields.UpdateCustomFieldCommand(
            workspaceId, projectId, fieldId, request.Name, request.FieldType, request.Options, request.IsRequired, request.SortOrder), ct);
        return NoContent();
    }

    [HttpGet("tasks/{taskId:guid}")]
    [ProducesResponseType(typeof(List<Application.Features.CustomFields.CustomFieldValueResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTaskValues(Guid workspaceId, Guid projectId, Guid taskId, CancellationToken ct)
    {
        var result = await sender.Send(new Application.Features.CustomFields.GetTaskCustomFieldValuesQuery(workspaceId, projectId, taskId), ct);
        return Ok(result);
    }

    /// <summary>
    /// Batch: custom-field values for every task in the project, in one query.
    /// BoardPage fetches this once instead of firing one request per task card
    /// (N+1 bottleneck).
    /// </summary>
    [HttpGet("tasks-values")]
    [ProducesResponseType(typeof(List<Application.Features.CustomFields.ProjectCustomFieldValuesResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProjectTaskValues(Guid workspaceId, Guid projectId, CancellationToken ct)
    {
        var result = await sender.Send(
            new Application.Features.CustomFields.GetProjectCustomFieldValuesQuery(workspaceId, projectId), ct);
        return Ok(result);
    }

    [HttpPost("tasks/{taskId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetValue(Guid workspaceId, Guid projectId, Guid taskId, SetCustomFieldValueRequest request, CancellationToken ct)
    {
        await sender.Send(new Application.Features.CustomFields.SetCustomFieldValueCommand(
            workspaceId, projectId, taskId, request.FieldId, request.Value), ct);
        return NoContent();
    }

    [HttpDelete("{fieldId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid workspaceId, Guid projectId, Guid fieldId, CancellationToken ct)
    {
        await sender.Send(new Application.Features.CustomFields.DeleteCustomFieldCommand(workspaceId, projectId, fieldId), ct);
        return NoContent();
    }
}

public sealed record CreateCustomFieldRequest(string Name, string FieldType, string? Options, bool IsRequired);
public sealed record UpdateCustomFieldRequest(string Name, string FieldType, string? Options, bool IsRequired, int SortOrder);
public sealed record SetCustomFieldValueRequest(Guid FieldId, string? Value);
