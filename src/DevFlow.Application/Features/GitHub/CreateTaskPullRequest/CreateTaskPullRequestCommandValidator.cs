using FluentValidation;

namespace DevFlow.Application.Features.GitHub.CreateTaskPullRequest;

public sealed class CreateTaskPullRequestCommandValidator : AbstractValidator<CreateTaskPullRequestCommand>
{
    private const int MaxBranchLength = 200;

    public CreateTaskPullRequestCommandValidator()
    {
        RuleFor(command => command.TaskId)
            .NotEmpty();

        // Optional — when absent the handler derives "{key}-{slugified title}".
        // GitHub ref rules: no whitespace, no "~ ^ : ? * [ \", no leading dots,
        // no "..", no trailing ".lock" or "/".
        RuleFor(command => command.BranchName)
            .MaximumLength(MaxBranchLength)
            .Matches("^[A-Za-z0-9._\\-/]+$")
            .When(command => !string.IsNullOrWhiteSpace(command.BranchName))
            .WithMessage("Branch name may only contain letters, digits, '.', '_', '-' and '/'.");

        RuleFor(command => command.BranchName)
            .Must(branch => branch is null || !branch.Contains(".."))
            .When(command => !string.IsNullOrWhiteSpace(command.BranchName))
            .WithMessage("Branch name may not contain '..'.");
    }
}
