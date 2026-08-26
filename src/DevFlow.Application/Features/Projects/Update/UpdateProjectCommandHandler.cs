using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Projects.Update;

public sealed class UpdateProjectCommandHandler(
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateProjectCommand>
{
    public async Task Handle(UpdateProjectCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Domain.Entities.Project), command.ProjectId);
        }

        project.UpdateDetails(command.Name, command.Description);
        project.UpdateEmoji(command.Emoji);
        project.UpdateCoverColor(command.CoverColor);

        if (command.ApproveAiPlans is not null)
        {
            project.SetApproveAiPlans(command.ApproveAiPlans.Value);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
