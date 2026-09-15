using System.Reflection;
using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Features.Labels;
using DevFlow.Application.Features.Tasks.Reorder;
using DevFlow.Domain.Enums;

namespace DevFlow.UnitTests.Features.Labels;

/// <summary>
/// Contract lock: every labels/reorder request the routes expose must be an
/// IWorkspaceRequest (so WorkspaceAuthorizationBehavior gates it on real
/// membership) carrying an explicit minimum role, and the ones that mutate
/// board-cached rows must stay IProjectEvent carriers. The ultracode
/// authz sweep found the whole labels controller and Reorder dispatching
/// attacker-controlled project ids with no workspace check at all; these
/// assertions make the omission a compile-visible test failure again.
/// </summary>
public class LabelAndReorderAuthorizationContractTests
{
    private static readonly Type[] WorkspaceGatedRequests =
    [
        typeof(GetLabelsQuery),
        typeof(CreateLabelCommand),
        typeof(DeleteLabelCommand),
        typeof(AssignLabelToTaskCommand),
        typeof(RemoveLabelFromTaskCommand),
        typeof(ReorderTasksCommand),
    ];

    [Theory]
    [MemberData(nameof(WorkspaceGatedRequestsData))]
    public void Request_ShouldBeWorkspaceGatedWithExplicitRole(Type requestType)
    {
        Assert.True(
            typeof(IWorkspaceRequest).IsAssignableFrom(requestType),
            $"{requestType.Name} must implement IWorkspaceRequest so the pipeline checks membership.");

        var role = requestType
            .GetCustomAttribute<RequireWorkspaceRoleAttribute>()?
            .MinimumRole;

        Assert.Equal(WorkspaceRole.Member, role);
    }

    [Theory]
    [MemberData(nameof(BoardCacheMutatingRequestsData))]
    public void BoardMutatingRequest_ShouldForceProjectCacheTag(Type requestType)
    {
        Assert.True(
            typeof(IProjectEvent).IsAssignableFrom(requestType),
            $"{requestType.Name} mutates board-cached rows and must invalidate the project tag.");
    }

    public static TheoryData<Type> WorkspaceGatedRequestsData()
    {
        var data = new TheoryData<Type>();
        foreach (var type in WorkspaceGatedRequests)
        {
            data.Add(type);
        }
        return data;
    }

    public static TheoryData<Type> BoardCacheMutatingRequestsData()
    {
        var data = new TheoryData<Type>();
        foreach (var type in new[]
        {
            typeof(DeleteLabelCommand),
            typeof(AssignLabelToTaskCommand),
            typeof(RemoveLabelFromTaskCommand),
            typeof(ReorderTasksCommand),
        })
        {
            data.Add(type);
        }
        return data;
    }
}
