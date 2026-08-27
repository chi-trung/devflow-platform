using DevFlow.Application.Features.Ai.Execute;

namespace DevFlow.Api.Contracts.Ai;

/// <summary>
/// Body for the AI execute/confirm endpoint — the single action the user
/// accepted from the review list.
/// </summary>
public sealed record AiExecuteConfirmRequest(AiExecuteActionContract Action);
