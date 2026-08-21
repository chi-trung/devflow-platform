using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.RemoveTask;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record RemoveTaskFromSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid SprintId,
    Guid TaskId) : IRequest, IWorkspaceRequest, IProjectEvent
{
        public string ActivityVerb => "pulled task back to backlog";
        public string ActivityLabel => "a task";
        public Guid? ActivityTaskId => TaskId;
    }
