using FluentValidation;

namespace DevFlow.Application.Features.Knowledge.Create;

public sealed class CreateKnowledgeEntryCommandValidator : AbstractValidator<CreateKnowledgeEntryCommand>
{
    public CreateKnowledgeEntryCommandValidator()
    {
        RuleFor(command => command.Title)
            .NotEmpty()
            .MaximumLength(300);

        RuleFor(command => command.Tags)
            .MaximumLength(500);
    }
}
