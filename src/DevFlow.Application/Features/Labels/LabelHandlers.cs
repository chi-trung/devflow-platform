using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Labels;

public sealed class GetLabelsHandler(
    ILabelRepository labelRepository) : IRequestHandler<GetLabelsQuery, IReadOnlyList<LabelResponse>>
{
    public async Task<IReadOnlyList<LabelResponse>> Handle(GetLabelsQuery query, CancellationToken cancellationToken)
    {
        var labels = await labelRepository.GetForProjectAsync(query.ProjectId, cancellationToken);

        return labels.Select(l => new LabelResponse(l.Id, l.Name, l.Color)).ToList();
    }
}

public sealed class GetLabelsForTaskHandler(
    ILabelRepository labelRepository) : IRequestHandler<GetLabelsForTaskQuery, IReadOnlyList<LabelResponse>>
{
    public async Task<IReadOnlyList<LabelResponse>> Handle(GetLabelsForTaskQuery query, CancellationToken cancellationToken)
    {
        var labels = await labelRepository.GetForTaskAsync(query.TaskItemId, cancellationToken);

        return labels.Select(l => new LabelResponse(l.Id, l.Name, l.Color)).ToList();
    }
}

public sealed class CreateLabelHandler(
    ILabelRepository labelRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateLabelCommand, LabelResponse>
{
    public async Task<LabelResponse> Handle(CreateLabelCommand command, CancellationToken cancellationToken)
    {
        if (await labelRepository.ExistsByNameInProjectAsync(command.ProjectId, command.Name, cancellationToken))
        {
            throw new ConflictException($"Label \"{command.Name}\" already exists in this project.");
        }

        var label = Label.Create(command.ProjectId, command.Name, command.Color);

        await labelRepository.AddAsync(label, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new LabelResponse(label.Id, label.Name, label.Color);
    }
}

public sealed class DeleteLabelHandler(
    ILabelRepository labelRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteLabelCommand>
{
    public async Task Handle(DeleteLabelCommand command, CancellationToken cancellationToken)
    {
        var label = await labelRepository.GetByIdAsync(command.LabelId, cancellationToken);

        if (label is null || label.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Label), command.LabelId);
        }

        await labelRepository.RemoveAsync(label, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}

public sealed class AssignLabelToTaskHandler(
    ILabelRepository labelRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<AssignLabelToTaskCommand>
{
    public async Task Handle(AssignLabelToTaskCommand command, CancellationToken cancellationToken)
    {
        var taskLabel = TaskLabel.Create(command.TaskItemId, command.LabelId);

        await labelRepository.AddTaskLabelAsync(taskLabel, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}

public sealed class RemoveLabelFromTaskHandler(
    ILabelRepository labelRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<RemoveLabelFromTaskCommand>
{
    public async Task Handle(RemoveLabelFromTaskCommand command, CancellationToken cancellationToken)
    {
        await labelRepository.RemoveTaskLabelAsync(command.TaskItemId, command.LabelId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
