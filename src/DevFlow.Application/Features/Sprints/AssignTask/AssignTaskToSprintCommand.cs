using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.AssignTask;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record AssignTaskToSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid SprintId,
    Guid TaskId) : IRequest, IWorkspaceRequest, IProjectEvent
{
        public string ActivityVerb => "scheduled task into sprint";
        public string ActivityLabel => "a task";
        public Guid? ActivityTaskId => TaskId;
    }
