using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.ProjectMembers;

public sealed class UpdateProjectMemberRoleCommandHandler(
    IProjectRepository projectRepository,
    IProjectMemberRepository projectMemberRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateProjectMemberRoleCommand>
{
    public async Task Handle(UpdateProjectMemberRoleCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken)
            ?? throw new NotFoundException(nameof(Project), command.ProjectId);

        if (project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var member = await projectMemberRepository.GetAsync(
            command.ProjectId, command.UserId, cancellationToken)
            ?? throw new NotFoundException(nameof(ProjectMember), command.UserId);

        member.UpdateRole(command.Role);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}