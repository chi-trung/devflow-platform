using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Projects.Archive;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record ArchiveProjectCommand(Guid WorkspaceId, Guid ProjectId) : IRequest, IWorkspaceRequest;
