using DevFlow.Application.Common.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/notifications")]
public sealed class NotificationsController(ISender sender, IUserContext userContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Notifications.NotificationResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNotifications(CancellationToken cancellationToken)
    {
        var notifications = await sender.Send(
            new Application.Features.Notifications.GetNotificationsQuery(userContext.UserId),
            cancellationToken);

        return Ok(notifications);
    }

    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnreadCount(CancellationToken cancellationToken)
    {
        var count = await sender.Send(
            new Application.Features.Notifications.GetUnreadCountQuery(userContext.UserId),
            cancellationToken);

        return Ok(count);
    }

    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Notifications.MarkNotificationReadCommand(userContext.UserId, id),
            cancellationToken);

        return NoContent();
    }

    [HttpPost("read-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkAllAsRead(CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Notifications.MarkAllNotificationsReadCommand(userContext.UserId),
            cancellationToken);

        return NoContent();
    }
}
