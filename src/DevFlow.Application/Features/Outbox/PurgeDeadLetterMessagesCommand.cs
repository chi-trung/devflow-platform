using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Outbox;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record PurgeDeadLetterMessagesCommand(Guid WorkspaceId) : IRequest<PurgeDeadLetterResponse>, IWorkspaceRequest;

public sealed record PurgeDeadLetterResponse(int Deleted);