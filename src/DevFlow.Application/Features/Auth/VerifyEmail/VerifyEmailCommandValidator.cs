using FluentValidation;

namespace DevFlow.Application.Features.Auth.VerifyEmail;

public sealed class VerifyEmailCommandValidator : AbstractValidator<VerifyEmailCommand>
{
    public VerifyEmailCommandValidator()
    {
        RuleFor(command => command.Token).NotEmpty();
    }
}
