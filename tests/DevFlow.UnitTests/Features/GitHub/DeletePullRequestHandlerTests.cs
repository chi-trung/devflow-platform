using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.GitHub;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.GitHub;

public class DeletePullRequestHandlerTests
{
    private readonly IGitHubRepository _gitHubRepository = Substitute.For<IGitHubRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();

    [Fact]
    public async Task Delete_ShouldRemoveRow_AndPersist()
    {
        var pr = PullRequest.Create(_projectId, "Fix login", "https://example.com/pr/1", "open", null);
        _gitHubRepository.GetPullRequestByIdAsync(_projectId, pr.Id, Arg.Any<CancellationToken>())
            .Returns(pr);

        var handler = new DeletePullRequestHandler(_gitHubRepository, _unitOfWork);

        await handler.Handle(new DeletePullRequestCommand(_workspaceId, _projectId, pr.Id), CancellationToken.None);

        _gitHubRepository.Received(1).RemovePullRequest(pr);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldThrowNotFound_WhenRowMissing()
    {
        var handler = new DeletePullRequestHandler(_gitHubRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new DeletePullRequestCommand(_workspaceId, _projectId, Guid.NewGuid()),
            CancellationToken.None));

        _gitHubRepository.DidNotReceive().RemovePullRequest(Arg.Any<PullRequest>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldMiss_WhenPullRequestBelongsToAnotherProject()
    {
        // The repository query is project-scoped; a foreign id must resolve
        // to null so the handler cannot touch another project's row.
        var foreignPr = PullRequest.Create(Guid.NewGuid(), "Other project PR", "https://example.com/pr/2", "open", null);
        _gitHubRepository.GetPullRequestByIdAsync(_projectId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((PullRequest?)null);

        var handler = new DeletePullRequestHandler(_gitHubRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new DeletePullRequestCommand(_workspaceId, _projectId, foreignPr.Id),
            CancellationToken.None));

        await _gitHubRepository.Received(1)
            .GetPullRequestByIdAsync(_projectId, foreignPr.Id, Arg.Any<CancellationToken>());
        _gitHubRepository.DidNotReceive().RemovePullRequest(Arg.Any<PullRequest>());
    }
}
