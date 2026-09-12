using System.Text;
using DevFlow.Api.Controllers;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Import;

public class ImportControllerCsvTests
{
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ISender _sender = Substitute.For<ISender>();

    private ImportController BuildController(string csv)
    {
        var controller = new ImportController(_taskItemRepository, _unitOfWork, _sender)
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
            .ImportTasks(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

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
            .ImportTasks(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

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
            .ImportTasks(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var importResult = Assert.IsType<ImportController.ImportResult>(ok.Value);
        Assert.Equal(1, importResult.Imported);

        // A phantom \r on the last column would break the Priority parse.
        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(t => t.Priority == Domain.Enums.TaskItemPriority.High),
            Arg.Any<CancellationToken>());
    }
}
