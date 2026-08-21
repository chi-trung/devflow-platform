using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Complete;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record CompleteSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid SprintId) : IRequest, IWorkspaceRequest, IProjectEvent
{
        public string ActivityVerb => "completed sprint";
        public string ActivityLabel => "a sprint";
        public Guid? ActivityTaskId => null;
    }
