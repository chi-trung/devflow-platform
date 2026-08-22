using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Reorder;

public sealed class ReorderTasksCommandHandler(
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<ReorderTasksCommand>
{
    public async Task Handle(ReorderTasksCommand command, CancellationToken cancellationToken)
    {
        foreach (var item in command.Tasks)
        {
            var task = await taskItemRepository.GetByIdAsync(item.Id, cancellationToken);
            if (task is null || task.ProjectId != command.ProjectId)
                continue;

            if (Enum.TryParse<TaskItemStatus>(item.Status, true, out var status))
            {
                task.ChangeStatus(status);
            }

            task.Position = item.Position;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
