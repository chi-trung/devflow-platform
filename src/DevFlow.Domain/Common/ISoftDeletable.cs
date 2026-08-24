namespace DevFlow.Domain.Common;

public interface ISoftDeletable
{
    DateTimeOffset? DeletedAtUtc { get; set; }
}