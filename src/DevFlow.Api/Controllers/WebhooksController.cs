using DevFlow.Application.Common.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/webhooks")]
public sealed class WebhooksController(
    IWebhookRepository webhookRepository,
    IUnitOfWork unitOfWork) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        Guid workspaceId,
        CancellationToken cancellationToken)
    {
        var webhooks = await webhookRepository.GetByWorkspaceIdAsync(workspaceId, cancellationToken);
        return Ok(webhooks.Select(w => new
        {
            w.Id,
            w.Url,
            w.Events,
            w.IsActive,
            w.CreatedAtUtc,
        }));
    }

    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        [FromBody] CreateWebhookRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Url))
            return BadRequest("URL is required.");

        if (request.Events.Length == 0)
            return BadRequest("At least one event is required.");

        var webhook = Domain.Entities.Webhook.Create(workspaceId, request.Url, request.Events, request.Secret);

        await webhookRepository.AddAsync(webhook, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { workspaceId, id = webhook.Id },
            new
            {
                webhook.Id,
                webhook.Url,
                webhook.Events,
                webhook.IsActive,
                webhook.CreatedAtUtc,
            });
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(
        Guid workspaceId,
        Guid id,
        CancellationToken cancellationToken)
    {
        var webhook = await webhookRepository.GetByIdAsync(id, cancellationToken);
        if (webhook is null || webhook.WorkspaceId != workspaceId)
            return NotFound();

        return Ok(new
        {
            webhook.Id,
            webhook.Url,
            webhook.Events,
            webhook.IsActive,
            webhook.Secret,
            webhook.CreatedAtUtc,
        });
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid workspaceId,
        Guid id,
        CancellationToken cancellationToken)
    {
        var webhook = await webhookRepository.GetByIdAsync(id, cancellationToken);
        if (webhook is null || webhook.WorkspaceId != workspaceId)
            return NotFound();

        webhookRepository.Remove(webhook);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    public sealed record CreateWebhookRequest(
        string Url,
        string[] Events,
        string? Secret);
}
