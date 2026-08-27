namespace DevFlow.Application.Common.Exceptions;

/// <summary>
/// Thrown by the AI client when the model hit its output-token ceiling
/// (finishReason = MAX_TOKENS) and the response is therefore cut off mid-JSON.
/// The caller can retry with a tighter prompt instead of treating the truncated
/// text as an empty or malformed answer.
/// </summary>
public sealed class AiResponseTruncatedException : Exception
{
    public AiResponseTruncatedException(string message) : base(message)
    {
    }
}
