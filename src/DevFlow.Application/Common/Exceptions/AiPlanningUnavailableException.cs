namespace DevFlow.Application.Common.Exceptions;

/// <summary>
/// Thrown when the AI planner is unavailable (no key configured) or the LLM
/// returns an empty/unparseable response. The frontend shows a friendly message
/// instead of a generic 500.
/// </summary>
public sealed class AiPlanningUnavailableException : Exception
{
    public AiPlanningUnavailableException(string message) : base(message)
    {
    }

    public AiPlanningUnavailableException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}