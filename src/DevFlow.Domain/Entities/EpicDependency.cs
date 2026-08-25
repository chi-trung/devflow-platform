using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

/// <summary>
/// Represents a dependency between two epics in the same project.
/// EpicId (dependent) is blocked by BlockedById (the epic blocking it).
/// Cycles are not enforced at MVP — callers should avoid introducing them.
/// </summary>
public class EpicDependency : BaseEntity
{
    private EpicDependency()
    {
    }

    private EpicDependency(Guid epicId, Guid blockedById)
    {
        EpicId = epicId;
        BlockedById = blockedById;
    }

    public Guid EpicId { get; private set; }

    public Guid BlockedById { get; private set; }

    public static EpicDependency Create(Guid epicId, Guid blockedById)
    {
        if (epicId == blockedById)
            throw new ArgumentException("An epic cannot block itself.");

        return new EpicDependency(epicId, blockedById);
    }
}
