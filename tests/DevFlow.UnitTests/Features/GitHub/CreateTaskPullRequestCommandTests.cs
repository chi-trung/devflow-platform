using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.GitHub.CreateTaskPullRequest;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using NSubstitute.ReceivedExtensions;

namespace DevFlow.UnitTests.Features.GitHub;

public class CreateTaskPullRequestCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IGitHubRepository _gitHubRepository = Substitute.For<IGitHubRepository>();
    private readonly ISocialLoginRepository _socialLoginRepository = Substitute.For<ISocialLoginRepository>();
    private readonly IGitHubApiClient _gitHubApiClient = Substitute.For<IGitHubApiClient>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;
    private readonly GitHubIntegration _integration;
    private readonly SocialLogin _login;

    public CreateTaskPullRequestCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Fix CORS headers", null, TaskItemPriority.Medium);
        _task.SetNumber(42);
        _integration = GitHubIntegration.Create(_project.Id, "https://github.com/acme/devflow", null);
        _login = SocialLogin.Create(_userId, "github", "gh-sub-1", "gho_test_token");

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
        _gitHubRepository.GetByProjectIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_integration);
        _socialLoginRepository.GetByUserAndProviderAsync(_userId, "github", Arg.Any<CancellationToken>()).Returns(_login);
        _userContext.UserId.Returns(_userId);

        _gitHubApiClient.GetRepositoryAsync("acme", "devflow", "gho_test_token", Arg.Any<CancellationToken>())
            .Returns(new GitHubRepositoryInfo("main"));
        _gitHubApiClient.GetBranchRefAsync("acme", "devflow", "main", "gho_test_token", Arg.Any<CancellationToken>())
            .Returns(new GitHubBranchRef("basesha", "treetha"));
        _gitHubApiClient.CreateCommitAsync("acme", "devflow", Arg.Any<string>(), "treetha", "basesha", "gho_test_token", Arg.Any<CancellationToken>())
            .Returns(new GitHubNewCommit("newsha"));
        _gitHubApiClient.CreatePullRequestAsync("acme", "devflow", Arg.Any<string>(), Arg.Any<string>(), "main", Arg.Any<string>(), "gho_test_token", Arg.Any<CancellationToken>())
            .Returns(new GitHubCreatedPr(7, "https://github.com/acme/devflow/pull/7", "octocat"));
    }

    private CreateTaskPullRequestCommandHandler CreateHandler() =>
        new(_projectRepository, _taskItemRepository, _gitHubRepository, _socialLoginRepository,
            _gitHubApiClient, _userContext, _unitOfWork);

    private CreateTaskPullRequestCommand Command(string? branchName = null) =>
        new(_workspaceId, _project.Id, _task.Id, branchName);

    [Fact]
    public async Task Handle_HappyPath_ShouldCreateBranchCommitPrAndStoreLinkedRow()
    {
        var response = await CreateHandler().Handle(Command(), CancellationToken.None);

        Received.InOrder(() =>
        {
            _gitHubApiClient.GetRepositoryAsync("acme", "devflow", "gho_test_token", Arg.Any<CancellationToken>());
            _gitHubApiClient.GetBranchRefAsync("acme", "devflow", "main", "gho_test_token", Arg.Any<CancellationToken>());
            _gitHubApiClient.CreateCommitAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
            _gitHubApiClient.CreateRefAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
            _gitHubApiClient.CreatePullRequestAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        });

        // Default branch name derives from the project key + task number + title slug.
        await _gitHubApiClient.Received(1).CreateRefAsync(
            "acme", "devflow", "dev-42-fix-cors-headers", "newsha", Arg.Any<string>(), Arg.Any<CancellationToken>());

        // PR title starts with the task key so it self-links.
        await _gitHubApiClient.Received(1).CreatePullRequestAsync(
            "acme", "devflow", "DEV-42: Fix CORS headers", "dev-42-fix-cors-headers", "main", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());

        await _gitHubRepository.Received(1).AddPullRequestAsync(
            Arg.Is<PullRequest>(pr =>
                pr.Url == "https://github.com/acme/devflow/pull/7" &&
                pr.Status == "Open" &&
                pr.HeadBranch == "dev-42-fix-cors-headers" &&
                pr.LinkedTaskId == _task.Id &&
                pr.Author == "octocat"),
            Arg.Any<CancellationToken>());

        Assert.Equal("https://github.com/acme/devflow/pull/7", response.Url);
        Assert.Equal("dev-42-fix-cors-headers", response.HeadBranch);
    }

    [Fact]
    public async Task Handle_NoGitHubLogin_ShouldConflictWithoutCallingApi()
    {
        _socialLoginRepository.GetByUserAndProviderAsync(_userId, "github", Arg.Any<CancellationToken>())
            .Returns((SocialLogin?)null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            CreateHandler().Handle(Command(), CancellationToken.None));

        Assert.Contains("Sign in with GitHub", ex.Message, StringComparison.Ordinal);
        await _gitHubApiClient.DidNotReceiveWithAnyArgs().GetRepositoryAsync(default!, default!, default!, default);
    }

    [Fact]
    public async Task Handle_InactiveIntegration_ShouldConflict()
    {
        _integration.Deactivate();

        await Assert.ThrowsAsync<ConflictException>(() =>
            CreateHandler().Handle(Command(), CancellationToken.None));

        await _gitHubApiClient.DidNotReceiveWithAnyArgs().GetRepositoryAsync(default!, default!, default!, default);
    }

    [Fact]
    public async Task Handle_BranchAlreadyExists_ShouldStillCreatePr()
    {
        _gitHubApiClient.CreateRefAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Throws(new GitHubApiException(422, "Reference already exists"));

        var response = await CreateHandler().Handle(Command(), CancellationToken.None);

        Assert.Equal("https://github.com/acme/devflow/pull/7", response.Url);
    }

    [Fact]
    public async Task Handle_TokenRevoked_ShouldMapToConflictWithSigninMessage()
    {
        _gitHubApiClient.GetRepositoryAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Throws(new GitHubApiException(401, "Bad credentials"));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            CreateHandler().Handle(Command(), CancellationToken.None));

        Assert.Contains("GitHub token", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Handle_ExplicitBranchName_ShouldBeUsed()
    {
        await CreateHandler().Handle(Command("feature/custom-branch"), CancellationToken.None);

        await _gitHubApiClient.Received(1).CreateRefAsync(
            "acme", "devflow", "feature/custom-branch", "newsha", Arg.Any<string>(), Arg.Any<CancellationToken>());
        await _gitHubApiClient.Received(1).CreatePullRequestAsync(
            "acme", "devflow", Arg.Any<string>(), "feature/custom-branch", "main", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_TaskFromAnotherProject_ShouldNotFound()
    {
        var otherProject = Project.Create(_workspaceId, "Other", "OTH", null);
        var foreignTask = TaskItem.Create(otherProject.Id, "Foreign task", null, TaskItemPriority.Low);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateHandler().Handle(
                new CreateTaskPullRequestCommand(_workspaceId, _project.Id, foreignTask.Id, "some-branch"),
                CancellationToken.None));
    }
}

public class CreateTaskPullRequestCommandValidatorTests
{
    private readonly CreateTaskPullRequestCommandValidator _validator = new();

    [Fact]
    public void Validate_NullBranchName_ShouldBeValid()
    {
        var result = _validator.Validate(new CreateTaskPullRequestCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null));
        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("feature/valid-branch_1.2")]
    [InlineData("justletters")]
    public void Validate_CleanBranchNames_ShouldBeValid(string branchName)
    {
        var result = _validator.Validate(new CreateTaskPullRequestCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), branchName));
        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("bad branch with spaces")]
    [InlineData("with..dotdot")]
    [InlineData("feat: Colon")]
    public void Validate_InvalidBranchNames_ShouldFail(string branchName)
    {
        var result = _validator.Validate(new CreateTaskPullRequestCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), branchName));
        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_OverlyLongBranchName_ShouldFail()
    {
        var branch = new string('a', 201);
        var result = _validator.Validate(new CreateTaskPullRequestCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), branch));
        Assert.False(result.IsValid);
    }
}
