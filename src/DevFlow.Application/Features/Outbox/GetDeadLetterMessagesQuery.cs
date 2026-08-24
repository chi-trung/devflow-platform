using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Outbox;

/// <summary>
/// Lists webhook outbox messages whose retries were exhausted (dead-lettered)
/// for a workspace. Admin-only.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record GetDeadLetterMessagesQuery(Guid WorkspaceId, int BatchSize = 100) : IRequest<IReadOnlyList<DeadLetterMessageDto>>, IWorkspaceRequest;
