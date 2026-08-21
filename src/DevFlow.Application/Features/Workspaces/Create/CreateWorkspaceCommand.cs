using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.Create;

public sealed record CreateWorkspaceCommand(
    string Name,
    string Slug,
    string? Description) : IRequest<Guid>;
