using DevFlow.Application.Features.Tasks;

namespace DevFlow.UnitTests.Features.Tasks;

public class TaskKeyTests
{
    [Fact]
    public void Format_ShouldCombineProjectKeyAndNumber()
    {
        Assert.Equal("DEV-42", TaskKey.Format("DEV", 42));
    }

    [Fact]
    public void Format_ShouldHandleSingleDigit()
    {
        Assert.Equal("DF-1", TaskKey.Format("DF", 1));
    }
}
