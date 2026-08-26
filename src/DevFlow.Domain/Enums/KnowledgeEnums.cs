namespace DevFlow.Domain.Enums;

public enum KnowledgeType
{
    Adr = 0,
    Pattern = 1,
    Runbook = 2
}

public enum KnowledgeStatus
{
    Draft = 0,
    Proposed = 1,
    Accepted = 2,
    Superseded = 3,
    Deprecated = 4
}
