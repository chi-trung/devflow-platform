using FluentValidation;

namespace DevFlow.Application.Features.Workspaces.Create;

public sealed class CreateWorkspaceCommandValidator : AbstractValidator<CreateWorkspaceCommand>
{
    public CreateWorkspaceCommandValidator()
    {
        RuleFor(command => command.Name)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(command => command.Slug)
            .NotEmpty()
            .MaximumLength(100)
            .Matches("^[a-z0-9]+(-[a-z0-9]+)*$")
            .WithMessage("Slug may only contain lowercase letters, digits and single hyphens.");

        RuleFor(command => command.Description)
            .MaximumLength(500);
    }
}
