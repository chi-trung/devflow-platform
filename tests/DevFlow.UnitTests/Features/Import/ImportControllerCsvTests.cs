using System.Text;
using DevFlow.Api.Controllers;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Import;
using DevFlow.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Import;

public class ImportControllerCsvTests
{
    private readonly Project _project = Project.Create(Guid.NewGuid(), "Import Target", "IMP", null);
    private readonly Guid _workspaceId;
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ISender _sender = Substitute.For<ISender>();

    public ImportControllerCsvTests()
    {
        _workspaceId = _project.WorkspaceId;
        // The controller now parses only — the writes ride ImportTasksCommand.
        // Route the sender through the real handler so these CSV round-trip
        // assertions still exercise parse → TaskItem.Create end to end.
        _projectRepository
            .GetByIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(_project);

        _sender
            .Send(Arg.Any<IRequest<ImportTasksResult>>(), Arg.Any<CancellationToken>())
            .Returns(ci => new ImportTasksCommandHandler(
                    _projectRepository, _taskItemRepository, _unitOfWork)
                .Handle((ImportTasksCommand)ci[0], CancellationToken.None));
    }

    private ImportController BuildController(string csv)
    {
        var controller = new ImportController(_sender)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    Request =
                    {
                        ContentType = "text/csv",
                        Body = new MemoryStream(Encoding.UTF8.GetBytes(csv)),
                    },
                },
            },
        };
        return controller;
    }

    [Fact]
    public async Task ImportFromCsv_ShouldPreserveQuotedCommasAndDoubledQuotes()
    {
        // The task export quotes every Title/Description and doubles inner
        // quotes (RFC 4180). The old Split(',') + Trim('"') reader shredded
        // "Fix, quickly" into two columns and left stray quotes elsewhere.
        var csv =
            "Id,Title,Description,Status,Priority,AssigneeId,EstimatedMinutes,CreatedAt,CompletedAt\n" +
            "1,\"Fix, quickly\",\"He said \"\"hi\"\"\",InProgress,High,,,\n";

        var result = await BuildController(csv)
            .ImportTasks(_workspaceId, _project.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var importResult = Assert.IsType<ImportController.ImportResult>(ok.Value);
        Assert.Equal(1, importResult.Imported);
        Assert.Empty(importResult.Errors);

        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(t => t.Title == "Fix, quickly"
                && t.Description == "He said \"hi\""
                && t.Status == Domain.Enums.TaskItemStatus.InProgress),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ImportFromCsv_ShouldKeepQuotedNewlinesInOneRow()
    {
        // Export emits raw newlines inside quoted descriptions; a naive
        // body.Split('\n') treated the tail as its own (garbage) row.
        var csv =
            "Id,Title,Description,Status,Priority,AssigneeId,EstimatedMinutes,CreatedAt,CompletedAt\n" +
            "1,\"Multi-line\",\"first\nsecond\",Idea,Medium,,,\n";

        var result = await BuildController(csv)
            .ImportTasks(_workspaceId, _project.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var importResult = Assert.IsType<ImportController.ImportResult>(ok.Value);
        Assert.Equal(1, importResult.Imported);
        Assert.Equal(0, importResult.Skipped);

        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(t => t.Title == "Multi-line"
                && t.Description == "first\nsecond"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ImportFromCsv_ShouldHandleCrlfLineEndings()
    {
        var csv =
            "Id,Title,Description,Status,Priority,AssigneeId,EstimatedMinutes,CreatedAt,CompletedAt\r\n" +
            "1,\"Ship it\",\"desc\",Idea,High,,,\r\n";

        var result = await BuildController(csv)
            .ImportTasks(_workspaceId, _project.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var importResult = Assert.IsType<ImportController.ImportResult>(ok.Value);
        Assert.Equal(1, importResult.Imported);

        // A phantom \r on the last column would break the Priority parse.
        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(t => t.Priority == Domain.Enums.TaskItemPriority.High),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ImportFromCsv_ShouldRejectProjectFromAnotherWorkspace()
    {
        // The endpoint used to create tasks in ANY project id with no auth and
        // no tenant check at all. The command now enforces
        // project.WorkspaceId == route workspaceId.
        var foreignWorkspaceId = Guid.NewGuid();
        var csv = "Title,Status,Priority\n\"Alien task\",Idea,Medium\n";

        var controller = BuildController(csv);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            controller.ImportTasks(foreignWorkspaceId, _project.Id, CancellationToken.None));

        await _taskItemRepository.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
    }
}
