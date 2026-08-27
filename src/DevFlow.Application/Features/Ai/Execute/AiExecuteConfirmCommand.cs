using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Ai.Execute;

/// <summary>
/// Executes a single AI-proposed action that the user accepted from the
/// review list. Only the action payload is needed — the pipeline re-runs it
/// through the shared AiActionExecutor so the result (and any downstream
/// side effects like the realtime broadcast) are identical to what the
/// execute endpoint would have produced.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record AiExecuteConfirmCommand(
    Guid WorkspaceId,
    Guid? ProjectId,
    AiExecuteActionContract Action) : IRequest<ExecutedAction>, IWorkspaceRequest;
