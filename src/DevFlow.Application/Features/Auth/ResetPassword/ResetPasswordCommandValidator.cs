using FluentValidation;

namespace DevFlow.Application.Features.Auth.ResetPassword;

public sealed class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordCommandValidator()
    {
        RuleFor(command => command.Token)
            .NotEmpty()
            .MaximumLength(200);

        // Mirrors RegisterCommandValidator's password rule exactly. A reset is
        // the only way back in for someone who cannot receive mail, so it must
        // not impose a stricter bar than sign-up — that locks people out of
        // the accounts they already have.
        RuleFor(command => command.NewPassword)
            .NotEmpty()
            .MinimumLength(8)
            .MaximumLength(128);
    }
}
