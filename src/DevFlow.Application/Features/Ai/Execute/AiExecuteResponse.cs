namespace DevFlow.Application.Features.Ai.Execute;

/// <summary>
/// Result of running an AI prompt: a natural-language summary plus one entry per
/// action the assistant attempted. Each action carries its own status so a
/// failure on one (e.g. the user lacks Admin to create a project) does not hide
/// the successes of the others.
/// </summary>
public sealed record AiExecuteResponse(
    string? Summary,
    IReadOnlyList<ExecutedAction> Actions,
    string? Error);

public sealed record ExecutedAction(
    string Type,
    string Label,
    Guid? EntityId,
    string Status,
    string? Message,
    AiExecuteActionContract? Contract = null);
