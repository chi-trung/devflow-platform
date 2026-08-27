using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Ai.Execute;

/// <summary>
/// Executes a single AI-proposed action that the user has accepted. The
/// action is run through the shared AiActionExecutor so the same switch
/// logic and resolution helpers are used — the executor commits via the
/// unit of work itself, and this handler only broadcasts the realtime
/// event afterwards.
/// </summary>
public sealed class AiExecuteConfirmCommandHandler(
    AiActionExecutor actionExecutor,
    IRealtimeNotifier realtimeNotifier) : IRequestHandler<AiExecuteConfirmCommand, ExecutedAction>
{
    public async Task<ExecutedAction> Handle(
        AiExecuteConfirmCommand command,
        CancellationToken cancellationToken)
    {
        ExecutedAction result;
        try
        {
            result = await actionExecutor.ExecuteActionAsync(
                command.WorkspaceId,
                command.ProjectId,
                command.Action,
                cancellationToken);
        }
        catch (ForbiddenAccessException)
        {
            return new ExecutedAction(
                command.Action.Type,
                command.Action.Title ?? command.Action.Type,
                null,
                "failed",
                "You do not have permission to perform this action.");
        }
        catch (NotFoundException ex)
        {
            return new ExecutedAction(
                command.Action.Type,
                command.Action.Title ?? command.Action.Type,
                null,
                "failed",
                ex.Message);
        }
        catch (Exception ex)
        {
            return new ExecutedAction(
                command.Action.Type,
                command.Action.Title ?? command.Action.Type,
                null,
                "failed",
                ex.Message);
        }

        // Broadcast the project event so connected clients see the new entity
        // without a manual F5 (create_task / create_subtask / create_sprint /
        // create_epic all carry a projectId after execution).
        if (command.ProjectId.HasValue)
        {
            await realtimeNotifier.NotifyProjectAsync(
                command.ProjectId.Value,
                command.Action.Type,
                cancellationToken);
        }

        return result;
    }
}