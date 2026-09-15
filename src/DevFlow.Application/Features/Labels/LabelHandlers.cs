using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Labels;

/// <summary>
/// Shared ownership check. The route's projectId is attacker-controlled
/// input, so each handler must confirm the project belongs to the claimed
/// workspace (membership alone says nothing about foreign projects) and,
/// for task/label ids, that those rows belong to that project. A forged
/// task+label pair from two different projects used to insert a TaskLabel
/// row that leaked one project's label id into another project's board
/// payload via the labelIds join.
/// </summary>
internal static class LabelGuard
{
    public static async Task EnsureProjectInWorkspaceAsync(
        IProjectRepository projectRepository,
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(projectId, cancellationToken);

        if (project is null || project.WorkspaceId != workspaceId)
        {
            throw new NotFoundException(nameof(Project), projectId);
        }
    }
}

public sealed class GetLabelsHandler(
    ILabelRepository labelRepository,
    IProjectRepository projectRepository) : IRequestHandler<GetLabelsQuery, IReadOnlyList<LabelResponse>>
{
    public async Task<IReadOnlyList<LabelResponse>> Handle(GetLabelsQuery query, CancellationToken cancellationToken)
    {
        await LabelGuard.EnsureProjectInWorkspaceAsync(
            projectRepository, query.WorkspaceId, query.ProjectId, cancellationToken);

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
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateLabelCommand, LabelResponse>
{
    public async Task<LabelResponse> Handle(CreateLabelCommand command, CancellationToken cancellationToken)
    {
        await LabelGuard.EnsureProjectInWorkspaceAsync(
            projectRepository, command.WorkspaceId, command.ProjectId, cancellationToken);

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
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteLabelCommand>
{
    public async Task Handle(DeleteLabelCommand command, CancellationToken cancellationToken)
    {
        await LabelGuard.EnsureProjectInWorkspaceAsync(
            projectRepository, command.WorkspaceId, command.ProjectId, cancellationToken);

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
    ITaskItemRepository taskItemRepository,
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<AssignLabelToTaskCommand>
{
    public async Task Handle(AssignLabelToTaskCommand command, CancellationToken cancellationToken)
    {
        await LabelGuard.EnsureProjectInWorkspaceAsync(
            projectRepository, command.WorkspaceId, command.ProjectId, cancellationToken);

        var task = await taskItemRepository.GetByIdAsync(command.TaskItemId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskItemId);
        }

        var label = await labelRepository.GetByIdAsync(command.LabelId, cancellationToken);

        if (label is null || label.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Label), command.LabelId);
        }

        var taskLabel = TaskLabel.Create(command.TaskItemId, command.LabelId);

        await labelRepository.AddTaskLabelAsync(taskLabel, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}

public sealed class RemoveLabelFromTaskHandler(
    ILabelRepository labelRepository,
    ITaskItemRepository taskItemRepository,
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<RemoveLabelFromTaskCommand>
{
    public async Task Handle(RemoveLabelFromTaskCommand command, CancellationToken cancellationToken)
    {
        await LabelGuard.EnsureProjectInWorkspaceAsync(
            projectRepository, command.WorkspaceId, command.ProjectId, cancellationToken);

        var task = await taskItemRepository.GetByIdAsync(command.TaskItemId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskItemId);
        }

        var label = await labelRepository.GetByIdAsync(command.LabelId, cancellationToken);

        if (label is null || label.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Label), command.LabelId);
        }

        await labelRepository.RemoveTaskLabelAsync(command.TaskItemId, command.LabelId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
