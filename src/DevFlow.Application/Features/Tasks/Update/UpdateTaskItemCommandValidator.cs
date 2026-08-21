using FluentValidation;

namespace DevFlow.Application.Features.Tasks.Update;

public sealed class UpdateTaskItemCommandValidator : AbstractValidator<UpdateTaskItemCommand>
{
    public UpdateTaskItemCommandValidator()
    {
        RuleFor(command => command.WorkspaceId)
            .NotEmpty();

        RuleFor(command => command.ProjectId)
            .NotEmpty();

        RuleFor(command => command.TaskId)
            .NotEmpty();

        RuleFor(command => command.Title)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(command => command.Description)
            .MaximumLength(5000);

        RuleFor(command => command.Status)
            .IsInEnum();

        RuleFor(command => command.Priority)
            .IsInEnum();
    }
}
