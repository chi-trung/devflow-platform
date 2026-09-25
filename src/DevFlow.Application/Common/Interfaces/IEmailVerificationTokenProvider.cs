namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Mints and validates the single-purpose tokens embedded in verification
/// links. Deliberately separate from <see cref="ITokenProvider"/> (the session
/// tokens) so the two can never be confused for one another.
/// </summary>
public interface IEmailVerificationTokenProvider
{
    /// <summary>Creates a token proving control of <paramref name="userId"/>'s address.</summary>
    string Generate(Guid userId);

    /// <summary>
    /// Returns the user id carried by a valid, unexpired token, or null when
    /// the token is malformed, forged, expired, or was issued for something
    /// else entirely (e.g. a session token pasted into the verify endpoint).
    /// Never throws — a bad token is an expected outcome, not an error.
    /// </summary>
    Guid? Validate(string? token);
}
