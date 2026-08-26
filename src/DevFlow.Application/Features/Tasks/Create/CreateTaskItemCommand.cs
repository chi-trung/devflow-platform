using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Create;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateTaskItemCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Title,
    string? Description,
    TaskItemPriority Priority,
    DateTimeOffset? DueDateUtc,
    string? DefinitionOfDone = null) : IRequest<TaskItemCreatedResponse>, IWorkspaceRequest, IProjectEvent
{
        public string ActivityVerb => "created task";
        public string ActivityLabel => Title;
        public Guid? ActivityTaskId => null;
    }

public sealed record TaskItemCreatedResponse(Guid Id);
