using FluentValidation;

namespace DevFlow.Application.Features.Auth.OAuth;

public sealed class LinkOAuthCommandValidator : AbstractValidator<LinkOAuthCommand>
{
    public LinkOAuthCommandValidator()
    {
        RuleFor(command => command.Provider)
            .NotEmpty()
            .MaximumLength(50);

        // An authorization code is single-use and short-lived. The bounds are
        // the shape of what a provider actually sends, not a security control —
        // the code is validated by the provider, not by this.
        RuleFor(command => command.Code)
            .NotEmpty()
            .MaximumLength(4096);

        // PKCE verifiers are 43–128 characters. GitHub uses classic OAuth and
        // sends nothing, so it is allowed to be empty.
        RuleFor(command => command.CodeVerifier)
            .MaximumLength(256);
    }
}
