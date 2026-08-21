using DevFlow.Application.Features.Workspaces.List;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.GetById;

public sealed record GetWorkspaceByIdQuery(Guid WorkspaceId) : IRequest<WorkspaceResponse>;
