using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Delete;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record DeleteTaskItemCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest, IWorkspaceRequest;
