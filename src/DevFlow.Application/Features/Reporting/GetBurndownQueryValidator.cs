using FluentValidation;

namespace DevFlow.Application.Features.Reporting;

/// <summary>
/// The burndown loop is driven entirely by the date range: it runs
/// <c>EndDate - StartDate</c> times, so a missing or reversed range does not
/// error — it silently returns an empty series, and the chart draws nothing
/// without ever saying why. An unparseable date parameter binds to
/// <see cref="DateOnly"/>'s default (0001-01-01), which is the case this exists
/// to catch.
/// </summary>
public sealed class GetBurndownQueryValidator : AbstractValidator<GetBurndownQuery>
{
    public GetBurndownQueryValidator()
    {
        RuleFor(query => query.WorkspaceId)
            .NotEmpty();

        RuleFor(query => query.ProjectId)
            .NotEmpty();

        RuleFor(query => query.StartDate)
            .NotEqual(default(DateOnly))
            .WithMessage("Start date is required.")
            .WithName("StartDate");

        RuleFor(query => query.EndDate)
            .NotEqual(default(DateOnly))
            .WithMessage("End date is required.")
            .WithName("EndDate");

        RuleFor(query => query)
            .Must(query => query.EndDate >= query.StartDate)
            .WithMessage("End date must be on or after start date.")
            .WithName("EndDate");
    }
}
