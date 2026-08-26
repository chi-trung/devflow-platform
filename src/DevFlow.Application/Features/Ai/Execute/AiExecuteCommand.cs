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
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record AiExecuteCommand(
    Guid WorkspaceId,
    Guid? ProjectId,
    string Prompt,
    string? PageContext) : IRequest<AiExecuteResponse>, IWorkspaceRequest;
