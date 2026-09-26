namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Builds the clickable verification URL for a user. Lives behind an
/// interface because the frontend base URL is configuration owned by the
/// infrastructure layer, which the application layer must not read directly.
/// </summary>
public interface IEmailVerificationLinkBuilder
{
    /// <summary>Returns the full link, including the token.</summary>
    string Build(Guid userId);
}
