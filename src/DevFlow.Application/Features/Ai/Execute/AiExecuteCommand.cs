using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Ai.Execute;

/// <summary>
/// Dispatches a natural-language prompt to the LLM and executes the returned
/// actions (create task, set deadline, assign, …). The workspace is required
/// (the current one from the route); the project is optional and the AI falls
/// back to the first project in the workspace when the prompt does not name one.
/// SprintId / EpicId are the route-level context the user is currently viewing —
/// the AI uses them to ground refs ("this sprint", "the current epic") and to
/// suggest context-appropriate actions.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record AiExecuteCommand(
    Guid WorkspaceId,
    Guid? ProjectId,
    string Prompt,
    string? PageContext,
    Guid? SprintId = null,
    Guid? EpicId = null) : IRequest<AiExecuteResponse>, IWorkspaceRequest, IWorkspaceEvent;
