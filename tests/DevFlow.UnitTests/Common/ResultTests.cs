using DevFlow.Domain.Common;

namespace DevFlow.UnitTests.Common;

public class ResultTests
{
    private static readonly Error TestError = Error.NotFound("user.not_found", "User was not found.");

    [Fact]
    public void Success_ShouldBeSuccess()
    {
        var result = Result.Success();

        Assert.True(result.IsSuccess);
        Assert.False(result.IsFailure);
        Assert.Equal(Error.None, result.Error);
    }

    [Fact]
    public void Failure_ShouldCarryError()
    {
        var result = Result.Failure(TestError);

        Assert.False(result.IsSuccess);
        Assert.True(result.IsFailure);
        Assert.Equal(TestError, result.Error);
    }

    [Fact]
    public void SuccessWithValue_ShouldExposeValue()
    {
        var result = Result.Success(42);

        Assert.True(result.IsSuccess);
        Assert.Equal(42, result.Value);
    }

    [Fact]
    public void FailureWithValue_ValueAccess_ShouldThrow()
    {
        var result = Result.Failure<int>(TestError);

        Assert.Throws<InvalidOperationException>(() => result.Value);
    }

    [Fact]
    public void ImplicitConversion_FromValue_ShouldProduceSuccess()
    {
        Result<string> result = "devflow";

        Assert.True(result.IsSuccess);
        Assert.Equal("devflow", result.Value);
    }

    [Fact]
    public void Success_WithError_ShouldThrow()
    {
        Assert.Throws<InvalidOperationException>(() => new TestableResult(true, TestError));
    }

    [Fact]
    public void Failure_WithoutError_ShouldThrow()
    {
        Assert.Throws<InvalidOperationException>(() => new TestableResult(false, Error.None));
    }

    private sealed class TestableResult : Result
    {
        public TestableResult(bool isSuccess, Error error)
            : base(isSuccess, error)
        {
        }
    }

    [Fact]
    public void NotFound_Factory_ShouldSetType()
    {
        var error = Error.NotFound("task.not_found", "Task was not found.");

        Assert.Equal(ErrorType.NotFound, error.Type);
        Assert.Equal("task.not_found", error.Code);
    }
}
