using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.CustomFields;
using DevFlow.Domain.Entities;
using NSubstitute;
using NSubstitute.ReturnsExtensions;
using Xunit;

namespace DevFlow.UnitTests.Features.CustomFields;

public class CreateCustomFieldHandlerTests
{
    private readonly ICustomFieldRepository _customFieldRepository = Substitute.For<ICustomFieldRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly CreateCustomFieldHandler _handler;

    public CreateCustomFieldHandlerTests()
    {
        _handler = new CreateCustomFieldHandler(_customFieldRepository, _unitOfWork);
    }

    [Fact]
    public async Task Handle_ShouldThrow_WhenNameIsEmpty()
    {
        var command = new CreateCustomFieldCommand(Guid.NewGuid(), Guid.NewGuid(), "", "text", null, false);

        await Assert.ThrowsAsync<ArgumentException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrow_WhenFieldTypeIsInvalid()
    {
        var command = new CreateCustomFieldCommand(Guid.NewGuid(), Guid.NewGuid(), "Status", "invalid", null, false);

        await Assert.ThrowsAsync<ArgumentException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldCreateCustomField_AndPersist()
    {
        var projectId = Guid.NewGuid();
        var command = new CreateCustomFieldCommand(Guid.NewGuid(), projectId, "Status", "select", "[\"todo\",\"done\"]", true);

        var fieldId = await _handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, fieldId);
        await _customFieldRepository.Received(1).AddAsync(
            Arg.Is<CustomField>(field => field.Name == "Status" && field.FieldType == "select" && field.IsRequired),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

public class UpdateCustomFieldHandlerTests
{
    private readonly ICustomFieldRepository _customFieldRepository = Substitute.For<ICustomFieldRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly UpdateCustomFieldHandler _handler;

    public UpdateCustomFieldHandlerTests()
    {
        _handler = new UpdateCustomFieldHandler(_customFieldRepository, _unitOfWork);
    }

    [Fact]
    public async Task Handle_ShouldThrow_WhenFieldNotFound()
    {
        _customFieldRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).ReturnsNull();

        var command = new UpdateCustomFieldCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Status", "select", null, false, 0);

        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldUpdateField_AndPersist()
    {
        var fieldId = Guid.NewGuid();
        var field = CustomField.Create(Guid.NewGuid(), "Status", "select", null, false);
        _customFieldRepository.GetByIdAsync(fieldId, Arg.Any<CancellationToken>()).Returns(field);

        var command = new UpdateCustomFieldCommand(Guid.NewGuid(), field.ProjectId, fieldId, "Priority", "text", null, true, 1);

        await _handler.Handle(command, CancellationToken.None);

        Assert.Equal("Priority", field.Name);
        Assert.Equal("text", field.FieldType);
        Assert.True(field.IsRequired);
        Assert.Equal(1, field.SortOrder);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

public class DeleteCustomFieldHandlerTests
{
    private readonly ICustomFieldRepository _customFieldRepository = Substitute.For<ICustomFieldRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly DeleteCustomFieldHandler _handler;

    public DeleteCustomFieldHandlerTests()
    {
        _handler = new DeleteCustomFieldHandler(_customFieldRepository, _unitOfWork);
    }

    [Fact]
    public async Task Handle_ShouldThrow_WhenFieldNotFound()
    {
        _customFieldRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).ReturnsNull();

        var command = new DeleteCustomFieldCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldRemoveField_AndPersist()
    {
        var field = CustomField.Create(Guid.NewGuid(), "Status", "select", null, false);
        _customFieldRepository.GetByIdAsync(field.Id, Arg.Any<CancellationToken>()).Returns(field);

        var command = new DeleteCustomFieldCommand(Guid.NewGuid(), field.ProjectId, field.Id);

        await _handler.Handle(command, CancellationToken.None);

        _customFieldRepository.Received(1).Remove(field);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

public class SetCustomFieldValueHandlerTests
{
    private readonly ICustomFieldRepository _customFieldRepository = Substitute.For<ICustomFieldRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly SetCustomFieldValueHandler _handler;

    public SetCustomFieldValueHandlerTests()
    {
        _handler = new SetCustomFieldValueHandler(_customFieldRepository, _unitOfWork);
    }

    [Fact]
    public async Task Handle_ShouldThrow_WhenFieldNotFound()
    {
        _customFieldRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).ReturnsNull();

        var command = new SetCustomFieldValueCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "todo");

        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldCreateValue_WhenNotExists()
    {
        var fieldId = Guid.NewGuid();
        var field = CustomField.Create(Guid.NewGuid(), "Status", "select", null, false);
        _customFieldRepository.GetByIdAsync(fieldId, Arg.Any<CancellationToken>()).Returns(field);
        _customFieldRepository.GetFieldValueAsync(Arg.Any<Guid>(), fieldId, Arg.Any<CancellationToken>()).ReturnsNull();

        var command = new SetCustomFieldValueCommand(Guid.NewGuid(), field.ProjectId, Guid.NewGuid(), fieldId, "todo");

        await _handler.Handle(command, CancellationToken.None);

        await _customFieldRepository.Received(1).AddFieldValueAsync(
            Arg.Is<TaskCustomFieldValue>(v => v.Value == "todo"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldUpdateValue_WhenExists()
    {
        var fieldId = Guid.NewGuid();
        var field = CustomField.Create(Guid.NewGuid(), "Status", "select", null, false);
        var existingValue = TaskCustomFieldValue.Create(Guid.NewGuid(), fieldId, "old");
        _customFieldRepository.GetByIdAsync(fieldId, Arg.Any<CancellationToken>()).Returns(field);
        _customFieldRepository.GetFieldValueAsync(Arg.Any<Guid>(), fieldId, Arg.Any<CancellationToken>()).Returns(existingValue);

        var command = new SetCustomFieldValueCommand(Guid.NewGuid(), field.ProjectId, Guid.NewGuid(), fieldId, "done");

        await _handler.Handle(command, CancellationToken.None);

        Assert.Equal("done", existingValue.Value);
        await _customFieldRepository.DidNotReceive().AddFieldValueAsync(Arg.Any<TaskCustomFieldValue>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

public class ListCustomFieldsHandlerTests
{
    private readonly ICustomFieldRepository _customFieldRepository = Substitute.For<ICustomFieldRepository>();

    private readonly ListCustomFieldsHandler _handler;

    public ListCustomFieldsHandlerTests()
    {
        _handler = new ListCustomFieldsHandler(_customFieldRepository);
    }

    [Fact]
    public async Task Handle_ShouldReturnFields_ForProject()
    {
        var fields = new List<CustomField>
        {
            CustomField.Create(Guid.NewGuid(), "Status", "select", "[\"todo\",\"done\"]", true),
            CustomField.Create(Guid.NewGuid(), "Priority", "text", null, false)
        };
        _customFieldRepository.GetByProjectIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(fields);

        var query = new ListCustomFieldsQuery(Guid.NewGuid(), Guid.NewGuid());

        var result = await _handler.Handle(query, CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal("Status", result[0].Name);
        Assert.True(result[0].IsRequired);
        Assert.Equal("Priority", result[1].Name);
        Assert.False(result[1].IsRequired);
    }
}
