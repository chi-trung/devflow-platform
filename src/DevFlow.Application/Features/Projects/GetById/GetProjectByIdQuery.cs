using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Features.Projects.List;
using MediatR;

namespace DevFlow.Application.Features.Projects.GetById;

public sealed record GetProjectByIdQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<ProjectResponse>, IWorkspaceRequest;
