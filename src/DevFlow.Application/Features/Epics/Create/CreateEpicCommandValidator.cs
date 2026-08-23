using FluentValidation;

namespace DevFlow.Application.Features.Epics.Create;

public sealed class CreateEpicCommandValidator : AbstractValidator<CreateEpicCommand>
{
    public CreateEpicCommandValidator()
    {
        RuleFor(command => command.WorkspaceId)
            .NotEmpty();

        RuleFor(command => command.ProjectId)
            .NotEmpty();

        RuleFor(command => command.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(command => command.Description)
            .MaximumLength(5000);

        RuleFor(command => command)
            .Must(command => !command.StartDateUtc.HasValue
                || !command.EndDateUtc.HasValue
                || command.EndDateUtc.Value >= command.StartDateUtc.Value)
            .WithMessage("End date must be after start date.")
            .WithName("EndDateUtc");
    }
}
