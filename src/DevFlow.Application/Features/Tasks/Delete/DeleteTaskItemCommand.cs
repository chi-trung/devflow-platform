using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Delete;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record DeleteTaskItemCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest, IWorkspaceRequest, IProjectEvent, IActivityLabelSink
{
        public string ActivityVerb => "deleted task";

        /// <summary>Placeholder only — once the row is gone the title is
        /// unrecoverable, so the handler resolves it before the write via
        /// <see cref="IActivityLabelSink"/>.</summary>
        public string ActivityLabel => "";

        public Guid? ActivityTaskId => TaskId;
        public string? ResolvedActivityLabel { get; set; }
    }
