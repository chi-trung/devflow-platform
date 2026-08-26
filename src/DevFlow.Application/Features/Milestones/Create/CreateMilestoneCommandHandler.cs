using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Milestones.Create;

public sealed class CreateMilestoneCommandHandler(
    IProjectRepository projectRepository,
    IMilestoneRepository milestoneRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateMilestoneCommand, MilestoneCreatedResponse>
{
    public async Task<MilestoneCreatedResponse> Handle(
        CreateMilestoneCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var milestone = Milestone.Create(
            command.ProjectId,
            command.Name,
            command.Description,
            command.TargetDateUtc);

        await milestoneRepository.AddAsync(milestone, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new MilestoneCreatedResponse(milestone.Id);
    }
}
