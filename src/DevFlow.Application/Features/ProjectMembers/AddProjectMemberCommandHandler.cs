using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.ProjectMembers;

public sealed class AddProjectMemberCommandHandler(
    IProjectRepository projectRepository,
    IProjectMemberRepository projectMemberRepository,
    IWorkspaceRepository workspaceRepository,
    IUserRepository userRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<AddProjectMemberCommand, ProjectMemberResponse>
{
    public async Task<ProjectMemberResponse> Handle(
        AddProjectMemberCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken)
            ?? throw new NotFoundException(nameof(Project), command.ProjectId);

        if (project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        // User must be a workspace member to be added to a project
        var workspaceRole = await workspaceRepository.GetMemberRoleAsync(
            command.WorkspaceId, command.UserId, cancellationToken);

        if (workspaceRole is null)
        {
            throw new NotFoundException(nameof(User), command.UserId);
        }

        var existing = await projectMemberRepository.ExistsAsync(
            command.ProjectId, command.UserId, cancellationToken);

        if (existing)
        {
            throw new ConflictException("User is already a member of this project.");
        }

        var user = await userRepository.GetByIdAsync(command.UserId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), command.UserId);

        var member = ProjectMember.Create(command.ProjectId, command.UserId, command.Role);
        await projectMemberRepository.AddAsync(member, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new ProjectMemberResponse(
            user.Id,
            user.Username,
            user.DisplayName,
            member.Role.ToString());
    }
}