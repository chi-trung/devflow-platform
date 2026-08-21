using DevFlow.Domain.Enums;
using FluentValidation;

namespace DevFlow.Application.Features.Workspaces.InviteMembers;

public sealed class InviteMemberCommandValidator : AbstractValidator<InviteMemberCommand>
{
    public InviteMemberCommandValidator()
    {
        RuleFor(command => command.WorkspaceId)
            .NotEmpty();

        RuleFor(command => command.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(command => command.Role)
            .NotEqual(WorkspaceRole.Owner)
            .WithMessage("Ownership cannot be granted through invitation.");
    }
}
