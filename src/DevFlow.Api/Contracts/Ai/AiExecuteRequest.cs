namespace DevFlow.Api.Contracts.Ai;

public sealed record AiExecuteRequest(
    string Prompt,
    string? PageContext);