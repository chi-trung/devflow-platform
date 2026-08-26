using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Milestones.Delete;

public sealed class DeleteMilestoneCommandHandler(
    IProjectRepository projectRepository,
    IMilestoneRepository milestoneRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteMilestoneCommand>
{
    public async Task Handle(DeleteMilestoneCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var milestone = await milestoneRepository.GetByIdAsync(command.MilestoneId, cancellationToken);

        if (milestone is null || milestone.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Milestone), command.MilestoneId);
        }

        await milestoneRepository.RemoveAsync(milestone, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
