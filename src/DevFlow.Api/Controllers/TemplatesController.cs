using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/templates")]
public sealed class TemplatesController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(List<Application.Features.Templates.TemplateResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid workspaceId, Guid projectId, CancellationToken ct)
    {
        var result = await sender.Send(new Application.Features.Templates.ListTemplatesQuery(workspaceId, projectId), ct);
        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(Guid), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(Guid workspaceId, Guid projectId, CreateTemplateRequest request, CancellationToken ct)
    {
        var id = await sender.Send(new Application.Features.Templates.CreateTemplateCommand(
            workspaceId, projectId, request.Name, request.Title, request.Description, request.Priority, request.EstimateMinutes), ct);
        return StatusCode(StatusCodes.Status201Created, id);
    }

    [HttpPost("{templateId:guid}/apply")]
    [ProducesResponseType(typeof(Guid), StatusCodes.Status201Created)]
    public async Task<IActionResult> Apply(Guid workspaceId, Guid projectId, Guid templateId, CancellationToken ct)
    {
        var taskId = await sender.Send(new Application.Features.Templates.ApplyTemplateCommand(workspaceId, projectId, templateId), ct);
        return StatusCode(StatusCodes.Status201Created, taskId);
    }

    [HttpDelete("{templateId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid workspaceId, Guid projectId, Guid templateId, CancellationToken ct)
    {
        await sender.Send(new Application.Features.Templates.DeleteTemplateCommand(workspaceId, projectId, templateId), ct);
        return NoContent();
    }
}

public sealed record CreateTemplateRequest(
    string Name, string? Title, string? Description, string Priority, int? EstimateMinutes);
