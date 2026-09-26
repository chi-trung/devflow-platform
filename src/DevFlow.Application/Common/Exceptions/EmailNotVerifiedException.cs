namespace DevFlow.Application.Common.Exceptions;

/// <summary>
/// The credentials were accepted but the address behind the account has not
/// been proven yet. Maps to 403, deliberately not 401: the frontend API client
/// silently refreshes and retries on a 401 (<c>api.ts</c>), which would hand a
/// token straight back to the very user this is meant to hold out.
/// </summary>
public sealed class EmailNotVerifiedException : Exception
{
    public EmailNotVerifiedException()
        : base("Verify your email address to continue.")
    {
    }

    public EmailNotVerifiedException(string message)
        : base(message)
    {
    }
}
