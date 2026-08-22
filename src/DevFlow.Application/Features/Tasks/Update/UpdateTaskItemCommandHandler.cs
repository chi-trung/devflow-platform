using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Update;

public sealed class UpdateTaskItemCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IWorkspaceRepository workspaceRepository,
    IUserRepository userRepository,
    IEmailService emailService,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateTaskItemCommand>
{
    public async Task Handle(UpdateTaskItemCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        if (command.AssigneeId is not null)
        {
            var assigneeRole = await workspaceRepository.GetMemberRoleAsync(
                command.WorkspaceId, command.AssigneeId.Value, cancellationToken);

            if (assigneeRole is null)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["AssigneeId"] = ["Assignee must be a member of the workspace."],
                });
            }
        }

        var oldAssigneeId = task.AssigneeId;

        task.UpdateDetails(command.Title, command.Description, command.Priority, command.DueDateUtc);
        task.ChangeStatus(command.Status);
        task.AssignTo(command.AssigneeId);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Send email when a new user is assigned
        if (command.AssigneeId is not null && command.AssigneeId != oldAssigneeId)
        {
            var assignee = await userRepository.GetByIdAsync(command.AssigneeId.Value, cancellationToken);
            if (assignee is not null && !string.IsNullOrWhiteSpace(assignee.Email))
            {
                _ = emailService.SendTaskAssignedEmailAsync(
                    assignee.Email,
                    command.Title,
                    project.Name,
                    "A team member")
                    .ContinueWith(_ => Task.CompletedTask, TaskContinuationOptions.OnlyOnCanceled);
            }
        }
    }
}
