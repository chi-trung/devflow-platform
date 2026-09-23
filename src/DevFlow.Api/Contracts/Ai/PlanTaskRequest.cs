namespace DevFlow.Api.Contracts.Ai;

public sealed record PlanTaskRequest(Guid TaskId, string? Prompt = null);
