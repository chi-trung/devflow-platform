using DevFlow.Application.Features.Reporting;
using FluentValidation;

namespace DevFlow.UnitTests.Features.Reporting;

/// <summary>
/// The burndown series has one point per day between the two dates, and the
/// loop is <c>for (i = 0; i &lt;= end - start; i++)</c>. A reversed or missing
/// range therefore does not fail — it produces an empty list, and the chart
/// draws nothing without ever saying why. These are the cases that used to come
/// back as a cheerful 200 with no data.
/// </summary>
public class GetBurndownQueryValidatorTests
{
    private readonly GetBurndownQueryValidator _validator = new();

    private GetBurndownQuery CreateQuery(DateOnly start, DateOnly end) =>
        new(Guid.NewGuid(), Guid.NewGuid(), start, end);

    private static bool IsValid(GetBurndownQuery query) =>
        new GetBurndownQueryValidator().Validate(query).IsValid;

    [Fact]
    public void ShouldReject_WhenBothDatesAreMissing()
    {
        // A blank or unparseable query parameter binds to DateOnly's default.
        // The chart used to render an empty series and look like a data problem.
        var result = _validator.Validate(CreateQuery(default, default));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == "StartDate");
        Assert.Contains(result.Errors, error => error.PropertyName == "EndDate");
    }

    [Fact]
    public void ShouldReject_WhenOnlyTheStartDateIsMissing()
    {
        var result = _validator.Validate(CreateQuery(default, new DateOnly(2026, 9, 19)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == "StartDate");
    }

    [Fact]
    public void ShouldReject_WhenEndPrecedesStart()
    {
        var result = _validator.Validate(
            CreateQuery(new DateOnly(2026, 10, 3), new DateOnly(2026, 9, 19)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == "EndDate");
    }

    [Fact]
    public void ShouldAcceptASingleDayRange()
    {
        // end == start is a legitimate "what is left today" question, and the
        // loop emits exactly one point. Only a strictly-earlier end is an error.
        var day = new DateOnly(2026, 9, 19);

        Assert.True(IsValid(CreateQuery(day, day)));
    }

    [Fact]
    public void ShouldAcceptAForwardRange()
    {
        Assert.True(IsValid(
            CreateQuery(new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 20))));
    }
}
