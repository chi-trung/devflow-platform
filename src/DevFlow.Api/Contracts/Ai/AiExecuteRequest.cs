namespace DevFlow.Api.Contracts.Ai;

using DevFlow.Application.Features.Ai.Execute;

public sealed record AiExecuteRequest(
    string Prompt,
    string? PageContext,
    IReadOnlyList<AiHistoryTurn>? History = null);
