using DevFlow.Api.Contracts.Knowledge;
using DevFlow.Application.Features.Knowledge.Create;
using DevFlow.Application.Features.Knowledge.Delete;
using DevFlow.Application.Features.Knowledge.List;
using DevFlow.Application.Features.Knowledge.Supersede;
using DevFlow.Application.Features.Knowledge.Update;
using DevFlow.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/knowledge")]
public sealed class KnowledgeController(ISender sender) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(KnowledgeEntryCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        Guid projectId,
        CreateKnowledgeEntryRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<KnowledgeType>(request.Type, ignoreCase: true, out var type))
        {
            return BadRequest($"Invalid knowledge type '{request.Type}'.");
        }

        var response = await sender.Send(
            new CreateKnowledgeEntryCommand(
                workspaceId,
                projectId,
                request.Title,
                request.Body,
                type,
                request.Tags),
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Knowledge.KnowledgeEntryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid workspaceId, Guid projectId, CancellationToken cancellationToken)
    {
        var entries = await sender.Send(
            new ListKnowledgeEntriesQuery(workspaceId, projectId),
            cancellationToken);

        return Ok(entries);
    }

    [HttpPut("{entryId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid workspaceId,
        Guid projectId,
        Guid entryId,
        UpdateKnowledgeEntryRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<KnowledgeType>(request.Type, ignoreCase: true, out var type))
        {
            return BadRequest($"Invalid knowledge type '{request.Type}'.");
        }

        if (!Enum.TryParse<KnowledgeStatus>(request.Status, ignoreCase: true, out var status))
        {
            return BadRequest($"Invalid knowledge status '{request.Status}'.");
        }

        await sender.Send(
            new UpdateKnowledgeEntryCommand(
                workspaceId,
                projectId,
                entryId,
                request.Title,
                request.Body,
                type,
                request.Tags,
                status),
            cancellationToken);

        return NoContent();
    }

    [HttpDelete("{entryId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid workspaceId,
        Guid projectId,
        Guid entryId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new DeleteKnowledgeEntryCommand(workspaceId, projectId, entryId),
            cancellationToken);

        return NoContent();
    }

    [HttpPost("{entryId:guid}/supersede")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Supersede(
        Guid workspaceId,
        Guid projectId,
        Guid entryId,
        SupersedeKnowledgeEntryRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new SupersedeKnowledgeEntryCommand(
                workspaceId,
                projectId,
                entryId,
                request.SupersededByEntryId),
            cancellationToken);

        return NoContent();
    }
}