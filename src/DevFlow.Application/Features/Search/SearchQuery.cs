using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Models;
using MediatR;

namespace DevFlow.Application.Features.Search;

public sealed record SearchResult(
    IReadOnlyList<TaskItemResult> Tasks,
    IReadOnlyList<ProjectResult> Projects,
    IReadOnlyList<EpicResult> Epics,
    IReadOnlyList<LabelResult> Labels,
    IReadOnlyList<UserResult> Users,
    IReadOnlyList<CommentResult> Comments);

public sealed record TaskItemResult(
    Guid Id,
    string Title,
    string Status,
    string ProjectKey);

public sealed record ProjectResult(
    Guid Id,
    string Name,
    string Key,
    string Status);

public sealed record EpicResult(
    Guid Id,
    string Name,
    string ProjectKey);

public sealed record LabelResult(
    Guid Id,
    string Name,
    string Color,
    string ProjectKey);

public sealed record UserResult(
    Guid Id,
    string DisplayName,
    string Username);

public sealed record CommentResult(
    Guid Id,
    string Content,
    Guid TaskItemId,
    string TaskTitle,
    string ProjectKey);

public sealed record SearchQuery(
    Guid WorkspaceId,
    string Keyword,
    string? Status = null,
    string? Priority = null,
    Guid? AssigneeId = null,
    Guid? LabelId = null,
    DateTime? DueBefore = null,
    DateTime? DueAfter = null) : IRequest<SearchResult>, IWorkspaceRequest;
