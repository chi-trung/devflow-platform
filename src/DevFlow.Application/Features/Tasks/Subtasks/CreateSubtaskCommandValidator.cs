using DevFlow.Domain.Enums;
using FluentValidation;

namespace DevFlow.Application.Features.Tasks.Subtasks;

public sealed class CreateSubtaskCommandValidator : AbstractValidator<CreateSubtaskCommand>
{
    public CreateSubtaskCommandValidator()
    {
        RuleFor(command => command.WorkspaceId)
            .NotEmpty();

        RuleFor(command => command.ProjectId)
            .NotEmpty();

        RuleFor(command => command.ParentTaskId)
            .NotEmpty();

        RuleFor(command => command.Title)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(command => command.Description)
            .MaximumLength(5000);

        RuleFor(command => command.Priority)
            .IsInEnum();
    }
}
