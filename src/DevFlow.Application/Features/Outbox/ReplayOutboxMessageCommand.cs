using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Outbox;

/// <summary>
/// Resets retry state for a dead-lettered outbox message so the next processor
/// cycle retries it. Admin-only; workspace-scoped.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record ReplayOutboxMessageCommand(Guid WorkspaceId, Guid MessageId) : IRequest, IWorkspaceRequest;
