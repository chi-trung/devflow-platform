using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Milestones.Update;

public sealed class UpdateMilestoneCommandHandler(
    IProjectRepository projectRepository,
    IMilestoneRepository milestoneRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateMilestoneCommand>
{
    public async Task Handle(UpdateMilestoneCommand command, CancellationToken cancellationToken)
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

        milestone.UpdateDetails(
            command.Name,
            command.Description,
            command.TargetDateUtc);

        milestone.UpdateStatus(command.Status);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
