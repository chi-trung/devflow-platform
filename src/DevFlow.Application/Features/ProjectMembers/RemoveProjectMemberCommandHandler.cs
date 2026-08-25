using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.ProjectMembers;

public sealed class RemoveProjectMemberCommandHandler(
    IProjectRepository projectRepository,
    IProjectMemberRepository projectMemberRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<RemoveProjectMemberCommand>
{
    public async Task Handle(RemoveProjectMemberCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken)
            ?? throw new NotFoundException(nameof(Project), command.ProjectId);

        if (project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var exists = await projectMemberRepository.ExistsAsync(
            command.ProjectId, command.UserId, cancellationToken);

        if (!exists)
        {
            throw new NotFoundException(nameof(ProjectMember), command.UserId);
        }

        await projectMemberRepository.RemoveAsync(command.ProjectId, command.UserId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}