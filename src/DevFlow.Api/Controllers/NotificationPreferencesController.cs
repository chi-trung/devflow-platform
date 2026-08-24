using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/users/me/notification-preferences")]
public sealed class NotificationPreferencesController(
    DevFlowDbContext dbContext,
    IUserContext userContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(NotificationPreferencesResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var userId = userContext.UserId;
        var prefs = await dbContext.NotificationPreferences
            .FirstOrDefaultAsync(np => np.UserId == userId, cancellationToken);

        if (prefs is null)
        {
            prefs = NotificationPreferences.Create(userId);
            dbContext.NotificationPreferences.Add(prefs);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(new NotificationPreferencesResponse(
            prefs.EmailOnAssignment,
            prefs.EmailOnMention,
            prefs.EmailOnSprintStarted,
            prefs.InAppOnAssignment,
            prefs.InAppOnMention,
            prefs.InAppOnSprintStarted,
            prefs.EmailOnStatusChanged,
            prefs.InAppOnStatusChanged,
            prefs.EmailOnCommentAdded,
            prefs.InAppOnCommentAdded,
            prefs.EmailOnRoleChanged,
            prefs.InAppOnRoleChanged,
            prefs.EmailOnRemovedFromWorkspace,
            prefs.InAppOnRemovedFromWorkspace));
    }

    [HttpPut]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Update(
        [FromBody] UpdateNotificationPreferencesRequest request,
        CancellationToken cancellationToken)
    {
        var userId = userContext.UserId;
        var prefs = await dbContext.NotificationPreferences
            .FirstOrDefaultAsync(np => np.UserId == userId, cancellationToken);

        if (prefs is null)
        {
            prefs = NotificationPreferences.Create(userId);
            dbContext.NotificationPreferences.Add(prefs);
        }

        prefs.EmailOnAssignment = request.EmailOnAssignment;
        prefs.EmailOnMention = request.EmailOnMention;
        prefs.EmailOnSprintStarted = request.EmailOnSprintStarted;
        prefs.InAppOnAssignment = request.InAppOnAssignment;
        prefs.InAppOnMention = request.InAppOnMention;
        prefs.InAppOnSprintStarted = request.InAppOnSprintStarted;
        prefs.EmailOnStatusChanged = request.EmailOnStatusChanged;
        prefs.InAppOnStatusChanged = request.InAppOnStatusChanged;
        prefs.EmailOnCommentAdded = request.EmailOnCommentAdded;
        prefs.InAppOnCommentAdded = request.InAppOnCommentAdded;
        prefs.EmailOnRoleChanged = request.EmailOnRoleChanged;
        prefs.InAppOnRoleChanged = request.InAppOnRoleChanged;
        prefs.EmailOnRemovedFromWorkspace = request.EmailOnRemovedFromWorkspace;
        prefs.InAppOnRemovedFromWorkspace = request.InAppOnRemovedFromWorkspace;

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    public sealed record NotificationPreferencesResponse(
        bool EmailOnAssignment,
        bool EmailOnMention,
        bool EmailOnSprintStarted,
        bool InAppOnAssignment,
        bool InAppOnMention,
        bool InAppOnSprintStarted,
        bool EmailOnStatusChanged,
        bool InAppOnStatusChanged,
        bool EmailOnCommentAdded,
        bool InAppOnCommentAdded,
        bool EmailOnRoleChanged,
        bool InAppOnRoleChanged,
        bool EmailOnRemovedFromWorkspace,
        bool InAppOnRemovedFromWorkspace);

    public sealed record UpdateNotificationPreferencesRequest(
        bool EmailOnAssignment,
        bool EmailOnMention,
        bool EmailOnSprintStarted,
        bool InAppOnAssignment,
        bool InAppOnMention,
        bool InAppOnSprintStarted,
        bool EmailOnStatusChanged,
        bool InAppOnStatusChanged,
        bool EmailOnCommentAdded,
        bool InAppOnCommentAdded,
        bool EmailOnRoleChanged,
        bool InAppOnRoleChanged,
        bool EmailOnRemovedFromWorkspace,
        bool InAppOnRemovedFromWorkspace);
}
