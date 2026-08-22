using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Comments.Create;
using DevFlow.Application.Features.Comments.Delete;
using DevFlow.Application.Features.Email;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Comments;

public class CommentHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ICommentRepository _commentRepository = Substitute.For<ICommentRepository>();
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _authorId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public CommentHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Design board", null, TaskItemPriority.High);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
        _userContext.UserId.Returns(_authorId);
    }

    [Fact]
    public async Task Create_ShouldPersistCommentWithCurrentUserAsAuthor()
    {
        var handler = new CreateCommentCommandHandler(
            _projectRepository, _taskItemRepository, _commentRepository,
            _userRepository, _notificationRepository, _emailService, _userContext, _unitOfWork);
        var command = new CreateCommentCommand(_workspaceId, _project.Id, _task.Id, "Looks good to me!");

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.Equal(_authorId, response.AuthorId);
        Assert.Equal("Looks good to me!", response.Content);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldAllowAuthorToDeleteOwnComment()
    {
        var comment = Comment.Create(_task.Id, _authorId, "My own comment");
        _commentRepository.GetByIdAsync(comment.Id, Arg.Any<CancellationToken>()).Returns(comment);

        var handler = new DeleteCommentCommandHandler(
            _projectRepository, _taskItemRepository, _commentRepository,
            _workspaceRepository, _userContext, _unitOfWork);
        var command = new DeleteCommentCommand(_workspaceId, _project.Id, _task.Id, comment.Id);

        await handler.Handle(command, CancellationToken.None);

        await _commentRepository.Received(1).RemoveAsync(comment, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldRejectMemberDeletingSomeoneElsesComment()
    {
        var strangerId = Guid.NewGuid();
        var comment = Comment.Create(_task.Id, strangerId, "Not mine");
        _commentRepository.GetByIdAsync(comment.Id, Arg.Any<CancellationToken>()).Returns(comment);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _authorId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var handler = new DeleteCommentCommandHandler(
            _projectRepository, _taskItemRepository, _commentRepository,
            _workspaceRepository, _userContext, _unitOfWork);
        var command = new DeleteCommentCommand(_workspaceId, _project.Id, _task.Id, comment.Id);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Delete_ShouldAllowAdminDeletingSomeoneElsesComment()
    {
        var strangerId = Guid.NewGuid();
        var comment = Comment.Create(_task.Id, strangerId, "Moderated away");
        _commentRepository.GetByIdAsync(comment.Id, Arg.Any<CancellationToken>()).Returns(comment);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _authorId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var handler = new DeleteCommentCommandHandler(
            _projectRepository, _taskItemRepository, _commentRepository,
            _workspaceRepository, _userContext, _unitOfWork);
        var command = new DeleteCommentCommand(_workspaceId, _project.Id, _task.Id, comment.Id);

        await handler.Handle(command, CancellationToken.None);

        await _commentRepository.Received(1).RemoveAsync(comment, Arg.Any<CancellationToken>());
    }
}
