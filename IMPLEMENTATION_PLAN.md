# Implementation Plan: Enhanced Task Dependencies Visual Graph

## Goal
Upgrade the existing dependency graph visualization from a basic, N+1-limited SVG modal into a full-featured interactive graph with project-level data, drag-and-drop editing, search/filter, and improved layout.

## Current State Analysis
- **Backend:** Has CRUD endpoints for dependencies per task (`GET/POST/DELETE /tasks/{id}/dependencies`). No project-level graph endpoint.
- **Frontend:** `GraphModal.tsx` exists but:
  - Uses N+1 API calls (fetches deps for each of first 25 tasks individually)
  - Limited to first 25 tasks
  - Fixed column layout by status (no auto-arrange)
  - Read-only (no drag-drop to create/delete)
  - No search/filter
  - No "blocked by" reverse view
- **Types:** `TaskDependencyResponse` has a mismatch: backend returns `Id, BlockedTaskId, BlockerTaskId, BlockerTitle, BlockerStatus, IsResolved` but frontend type is missing `blockedTaskId` and `isResolved`.

## Target State
- Single API call loads entire project dependency graph
- Interactive drag-and-drop to create/remove dependencies
- Search/filter tasks in the graph
- Toggle between "blockers" and "blocked by" views
- Auto-arrange layout (or improved fixed layout with all tasks)
- Circular dependency detection and prevention
- Fixed type consistency between backend and frontend

## Database Changes
**None.** The `TaskDependencies` table already exists and is fully functional.

## Backend Changes

### New Files
1. `src/DevFlow.Application/Features/Tasks/Dependencies/ProjectDependencyGraphResponse.cs`
   - DTOs: `TaskGraphNode`, `DependencyGraphEdge`, `ProjectDependencyGraphResponse`

2. `src/DevFlow.Application/Features/Tasks/Dependencies/GetProjectDependencyGraphQuery.cs` (or in DependencyHandlers.cs)

### Modified Files
1. `src/DevFlow.Application/Features/Tasks/Dependencies/DependencyHandlers.cs`
   - Add `GetProjectDependencyGraphQuery` + Handler
   - Add circular dependency detection in `AddTaskDependencyHandler` (prevent A→B→C→A)

2. `src/DevFlow.Api/Controllers/TasksController.cs`
   - Add `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/dependencies/graph`

3. `src/DevFlow.Infrastructure/Persistence/Repositories/ITaskDependencyRepository.cs`
   - Add `GetAllByProjectIdAsync(Guid projectId, CancellationToken)`

4. `src/DevFlow.Infrastructure/Persistence/Repositories/TaskDependencyRepository.cs`
   - Implement `GetAllByProjectIdAsync`

5. `src/DevFlow.Application/Features/Tasks/Dependencies/TaskDependencyResponse.cs`
   - Ensure constructor order matches frontend expectation or keep consistent. Actually, the backend record is fine; we will fix frontend type to match backend.

## Frontend Changes

### Modified Files
1. `frontend/src/lib/api.ts`
   - Add `getProjectDependencyGraph(workspaceId, projectId)` helper

2. `frontend/src/types/api.ts`
   - Fix `TaskDependencyResponse` to match backend exactly:
     ```typescript
     export interface TaskDependencyResponse {
       id: string;
       blockedTaskId: string;
       blockerTaskId: string;
       blockerTitle: string;
       blockerStatus: TaskItemResponse["status"];
       isResolved: boolean;
     }
     ```

3. `frontend/src/components/board/GraphModal.tsx`
   - Replace N+1 fetching with single `getProjectDependencyGraph` call
   - Remove `tasks.slice(0, 25)` limit
   - Add search input to filter visible tasks
   - Add drag-and-drop: drag from task A onto task B to create dependency A blocks B
   - Add right-click context menu or delete button on edges to remove dependency
   - Add toggle button: "Blockers" / "Blocked By"
   - Improve layout: use force-directed or at least status-based with better spacing
   - Keep circular dependency highlighting (already exists)

4. `frontend/src/pages/BoardPage.tsx`
   - Minor: ensure `tasks` prop passed to GraphModal contains all tasks (currently it does, but verify)

## Test Cases

### Backend
1. `GetProjectDependencyGraphQuery` returns correct nodes and edges for a project with dependencies
2. `GetProjectDependencyGraphQuery` returns empty graph when no dependencies exist
3. `AddTaskDependencyHandler` throws `ConflictException` on self-dependency
4. `AddTaskDependencyHandler` throws `ConflictException` on duplicate dependency
5. `AddTaskDependencyHandler` throws `ConflictException` on circular dependency (A→B, B→C, C→A)
6. Existing `GetTaskDependenciesQuery` still works (backward compat)

### Frontend
1. GraphModal loads without N+1 waterfall (verify single network request)
2. Search filters tasks in graph correctly
3. Drag-and-drop creates dependency and shows edge
4. Delete edge removes dependency
5. Toggle "Blocked By" reverses edge direction
6. Circular dependencies are highlighted in red

## Deployment Considerations
- No database migration required
- New endpoint is additive → backward compatible
- Old per-task endpoints remain unchanged
- Frontend change is isolated to GraphModal component
- No breaking changes to existing API consumers

## Rollback Considerations
- Backend: revert branch, old endpoints still work
- Frontend: revert branch, old GraphModal behavior restored
- No data migration to reverse

## Communication Between Agents
- Backend agent must commit and push before frontend agent starts
- Frontend agent will read backend API contract from the code after it is merged/pushed
- If backend API changes during implementation, frontend agent must adapt
