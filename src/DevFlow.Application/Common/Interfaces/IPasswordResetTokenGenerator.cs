namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Mints the opaque string that travels in a reset link.
///
/// This is deliberately NOT a JWT. A signed self-contained token stays valid
/// until it expires no matter what the database says, so "used once" would
/// mean "the first person to click", and the first person to click is whoever
/// the mail scanner was. A random value that the database is the only thing
/// that can resolve is what makes single-use actually enforceable.
/// </summary>
public interface IPasswordResetTokenGenerator
{
    /// <summary>Returns a fresh, cryptographically random token.</summary>
    string Generate();
}
