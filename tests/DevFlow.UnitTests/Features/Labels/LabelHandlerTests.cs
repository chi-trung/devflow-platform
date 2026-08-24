using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Labels;
using DevFlow.Domain.Entities;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Labels;

public class LabelHandlerTests
{
    private readonly ILabelRepository _labelRepository = Substitute.For<ILabelRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _projectId = Guid.NewGuid();

    [Fact]
    public async Task Create_ShouldPersistLabel()
    {
        _labelRepository.ExistsByNameInProjectAsync(_projectId, "Bug", Arg.Any<CancellationToken>()).Returns(false);

        var handler = new CreateLabelHandler(_labelRepository, _unitOfWork);
        var result = await handler.Handle(new CreateLabelCommand(_projectId, "Bug", "#f87171"), CancellationToken.None);

        Assert.Equal("Bug", result.Name);
        Assert.Equal("#f87171", result.Color);
        await _labelRepository.Received(1).AddAsync(Arg.Any<Label>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Create_ShouldThrowConflict_WhenNameExists()
    {
        _labelRepository.ExistsByNameInProjectAsync(_projectId, "Bug", Arg.Any<CancellationToken>()).Returns(true);

        var handler = new CreateLabelHandler(_labelRepository, _unitOfWork);

        await Assert.ThrowsAsync<ConflictException>(
            () => handler.Handle(new CreateLabelCommand(_projectId, "Bug", "#f87171"), CancellationToken.None));
    }

    [Fact]
    public async Task Delete_ShouldRemoveLabel()
    {
        var label = Label.Create(_projectId, "Bug", "#f87171");
        _labelRepository.GetByIdAsync(label.Id, Arg.Any<CancellationToken>()).Returns(label);

        var handler = new DeleteLabelHandler(_labelRepository, _unitOfWork);
        await handler.Handle(new DeleteLabelCommand(_projectId, label.Id), CancellationToken.None);

        await _labelRepository.Received(1).RemoveAsync(label, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldThrowNotFound_WhenLabelInOtherProject()
    {
        var label = Label.Create(Guid.NewGuid(), "Other", "#000000");
        _labelRepository.GetByIdAsync(label.Id, Arg.Any<CancellationToken>()).Returns(label);

        var handler = new DeleteLabelHandler(_labelRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(
            () => handler.Handle(new DeleteLabelCommand(_projectId, label.Id), CancellationToken.None));
    }

    [Fact]
    public async Task List_ShouldReturnProjectLabels()
    {
        var labels = new[] { Label.Create(_projectId, "Bug", "#f87171"), Label.Create(_projectId, "Feature", "#2dd4bf") };
        _labelRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>()).Returns(labels);

        var handler = new GetLabelsHandler(_labelRepository);
        var result = await handler.Handle(new GetLabelsQuery(_projectId), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, l => l.Name == "Bug");
    }
}
