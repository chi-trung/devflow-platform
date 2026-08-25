using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Outbox;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record ReplayAllOutboxMessagesCommand(Guid WorkspaceId) : IRequest<ReplayAllResponse>, IWorkspaceRequest;

public sealed record ReplayAllResponse(int Requeued);