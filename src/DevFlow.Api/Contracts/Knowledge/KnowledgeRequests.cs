namespace DevFlow.Api.Contracts.Knowledge;

public sealed record CreateKnowledgeEntryRequest(
    string Title,
    string? Body,
    string Type,
    string? Tags);

public sealed record UpdateKnowledgeEntryRequest(
    string Title,
    string? Body,
    string Type,
    string? Tags,
    string Status);

public sealed record SupersedeKnowledgeEntryRequest(
    Guid SupersededByEntryId);