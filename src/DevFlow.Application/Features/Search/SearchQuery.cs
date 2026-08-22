using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Models;
using MediatR;

namespace DevFlow.Application.Features.Search;

public sealed record SearchResult(
    IReadOnlyList<TaskItemResult> Tasks,
    IReadOnlyList<ProjectResult> Projects);

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

public sealed record SearchQuery(
    Guid WorkspaceId,
    string Keyword,
    string? Status = null,
    string? Priority = null,
    Guid? AssigneeId = null,
    Guid? LabelId = null,
    DateTime? DueBefore = null,
    DateTime? DueAfter = null) : IRequest<SearchResult>, IWorkspaceRequest;
