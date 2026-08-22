using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Comments;
using DevFlow.Application.Features.Comments.Create;
using DevFlow.Application.Features.Email;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Comments;

public class CreateCommentMentionNotificationTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ICommentRepository _commentRepository = Substitute.For<ICommentRepository>();
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;
    private readonly User _author;

    public CreateCommentMentionNotificationTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Design board", null, TaskItemPriority.High);
        _author = CreateUser("author");

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
        _userContext.UserId.Returns(_author.Id);
    }

    [Fact]
    public async Task Handle_WithSingleMention_ShouldCreateMentionNotificationForMentionedUser()
    {
        var mentionedUser = CreateUser("phuong");
        SetupUserLookup(mentionedUser);

        await Handle("hey @phuong please review");

        await _notificationRepository.Received(1).AddAsync(
            Arg.Is<Notification>(n =>
                n.UserId == mentionedUser.Id &&
                n.Type == "Mention" &&
                n.TaskItemId == _task.Id &&
                n.ProjectId == _project.Id &&
                n.WorkspaceId == _workspaceId),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_NotificationMessageShouldReferenceTaskTitle()
    {
        SetupUserLookup(CreateUser("phuong"));

        await Handle("hey @phuong");

        await _notificationRepository.Received(1).AddAsync(
            Arg.Is<Notification>(n => n.Message.Contains(_task.Title)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithDuplicateMentions_ShouldCreateOneNotificationPerDistinctUser()
    {
        var phuong = CreateUser("phuong");
        var trung = CreateUser("trung");
        SetupUserLookup(phuong, trung);

        await Handle("@phuong @trung @PHUONG shipping today");

        await _notificationRepository.Received(1).AddAsync(
            Arg.Is<Notification>(n => n.UserId == phuong.Id && n.Type == "Mention"),
            Arg.Any<CancellationToken>());
        await _notificationRepository.Received(1).AddAsync(
            Arg.Is<Notification>(n => n.UserId == trung.Id && n.Type == "Mention"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenAuthorMentionsSelf_ShouldNotCreateSelfNotification()
    {
        SetupUserLookup(_author);

        await Handle($"note to self @{_author.Username}");

        await _notificationRepository.DidNotReceive().AddAsync(Arg.Any<Notification>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownUsername_ShouldIgnoreAndStillPersistComment()
    {
        SetupUserLookup(CreateUser("phuong"));
        _userRepository
            .GetByUsernameAsync("ghost", Arg.Any<CancellationToken>())
            .Returns((User?)null);

        await Handle("cc @ghost from marketing");

        await _notificationRepository.DidNotReceive().AddAsync(Arg.Any<Notification>(), Arg.Any<CancellationToken>());
        await _commentRepository.Received(1).AddAsync(Arg.Any<Comment>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithoutMentions_ShouldNotTouchNotifications()
    {
        await Handle("plain comment, no one to notify");

        await _notificationRepository.DidNotReceive().AddAsync(Arg.Any<Notification>(), Arg.Any<CancellationToken>());
        await _userRepository.DidNotReceive().GetByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithEmailLikeToken_ShouldNotCreateFalsePositiveMention()
    {
        SetupUserLookup(CreateUser("phuong"));

        await Handle("contact test@phuong.com about the board");

        await _notificationRepository.DidNotReceive().AddAsync(Arg.Any<Notification>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownTask_ShouldThrowNotFoundAndSkipMentions()
    {
        SetupUserLookup(CreateUser("phuong"));

        await Assert.ThrowsAsync<NotFoundException>(
            () => Handle("hey @phuong on a ghost task", Guid.NewGuid()));

        await _notificationRepository.DidNotReceive().AddAsync(Arg.Any<Notification>(), Arg.Any<CancellationToken>());
    }

    private async Task<CommentResponse> Handle(string content, Guid? taskId = null)
    {
        var handler = new CreateCommentCommandHandler(
            _projectRepository,
            _taskItemRepository,
            _commentRepository,
            _userRepository,
            _notificationRepository,
            _emailService,
            _userContext,
            _unitOfWork);
        var command = new CreateCommentCommand(
            _workspaceId, _project.Id, taskId ?? _task.Id, content);

        return await handler.Handle(command, CancellationToken.None);
    }

    private static User CreateUser(string username) =>
        User.Create(
            $"{username}@devflow.local",
            username,
            "Password123!",
            char.ToUpperInvariant(username[0]) + username[1..]);

    private void SetupUserLookup(params User[] users)
    {
        foreach (var user in users)
        {
            _userRepository
                .GetByUsernameAsync(user.Username, Arg.Any<CancellationToken>())
                .Returns(user);
        }
    }
}
