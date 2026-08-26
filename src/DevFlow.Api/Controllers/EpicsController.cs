using DevFlow.Api.Contracts.Epics;
using DevFlow.Application.Features.Epics.Create;
using DevFlow.Application.Features.Epics.Delete;
using DevFlow.Application.Features.Epics.List;
using DevFlow.Application.Features.Epics.Update;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/epics")]
public sealed class EpicsController(ISender sender) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(EpicCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        Guid projectId,
        CreateEpicRequest request,
        CancellationToken cancellationToken)
    {
        var epic = await sender.Send(
            new CreateEpicCommand(
                workspaceId,
                projectId,
                request.Name,
                request.Description,
                request.MilestoneId,
                request.StartDateUtc,
                request.EndDateUtc),
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new EpicCreatedResponse(epic.Id));
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Epics.EpicResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid workspaceId, Guid projectId, CancellationToken cancellationToken)
    {
        var epics = await sender.Send(
            new ListEpicsQuery(workspaceId, projectId),
            cancellationToken);

        return Ok(epics);
    }

    [HttpPut("{epicId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid workspaceId,
        Guid projectId,
        Guid epicId,
        UpdateEpicRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new UpdateEpicCommand(
                workspaceId,
                projectId,
                epicId,
                request.Name,
                request.Description,
                request.MilestoneId,
                request.StartDateUtc,
                request.EndDateUtc),
            cancellationToken);

        return NoContent();
    }

    [HttpDelete("{epicId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid workspaceId,
        Guid projectId,
        Guid epicId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new DeleteEpicCommand(workspaceId, projectId, epicId),
            cancellationToken);

        return NoContent();
    }

    [HttpGet("{epicId:guid}/dependencies")]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Epics.Dependencies.EpicDependencyResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListDependencies(
        Guid workspaceId,
        Guid projectId,
        Guid epicId,
        CancellationToken cancellationToken)
    {
        var dependencies = await sender.Send(
            new Application.Features.Epics.Dependencies.ListEpicDependenciesQuery(workspaceId, projectId, epicId),
            cancellationToken);

        return Ok(dependencies);
    }

    [HttpPost("{epicId:guid}/dependencies")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddDependency(
        Guid workspaceId,
        Guid projectId,
        Guid epicId,
        AddEpicDependencyRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Epics.Dependencies.AddEpicDependencyCommand(
                workspaceId, projectId, epicId, request.BlockedByEpicId),
            cancellationToken);

        return NoContent();
    }

    [HttpDelete("{epicId:guid}/dependencies/{blockedByEpicId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveDependency(
        Guid workspaceId,
        Guid projectId,
        Guid epicId,
        Guid blockedByEpicId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Epics.Dependencies.RemoveEpicDependencyCommand(
                workspaceId, projectId, epicId, blockedByEpicId),
            cancellationToken);

        return NoContent();
    }
}
