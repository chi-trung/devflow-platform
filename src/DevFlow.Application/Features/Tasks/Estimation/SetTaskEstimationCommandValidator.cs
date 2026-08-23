using FluentValidation;

namespace DevFlow.Application.Features.Tasks.Estimation;

public sealed class SetTaskEstimationCommandValidator : AbstractValidator<SetTaskEstimationCommand>
{
    public SetTaskEstimationCommandValidator()
    {
        RuleFor(command => command.WorkspaceId)
            .NotEmpty();

        RuleFor(command => command.ProjectId)
            .NotEmpty();

        RuleFor(command => command.TaskId)
            .NotEmpty();

        RuleFor(command => command.StoryPoints)
            .Must(points => points is null
                || SetTaskEstimationCommandHandler.AllowedStoryPoints.Contains(points.Value))
            .WithMessage("Story points must be one of the Fibonacci values: 1, 2, 3, 5, 8, 13, 21.");
    }
}
