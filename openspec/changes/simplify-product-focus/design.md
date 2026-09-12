## Context

Task state and handlers live in `App.jsx`; task CRUD shares `firestoreService.js`; every calendar receives tasks; task creation shares `AddItemModal`; task details and list are separate components. Preparation records already attach directly to events and do not require task records.

## Goals / Non-Goals

**Goals:**

- Remove task behavior without affecting event, preparation or travel-plan data.
- Reduce the UI state and navigation before responsive redesign.

**Non-Goals:**

- Deleting or transforming users' existing task documents.
- Reusing task components for preparations.

## Decisions

1. Stop reading `tasks` in the initial Firestore load before removing React state and handlers. Keep task service functions temporarily only until all imports are removed, then delete them and the task-only components.
2. Make `AddItemModal` event-only and remove task branches from month/week/day components rather than leaving hidden feature flags.
3. Remove task styles after component removal, while retaining shared button/modal styles that other screens use.
4. Do not change Firestore rules. The existing user subtree rule continues to protect dormant task documents and avoids destructive migration.
5. Update current docs/specs only when the change is implemented and verified; the delta spec remains the planned contract until archive.

## Risks / Trade-offs

- [Shared modal code may hide task-only branches] -> Use repository-wide symbol searches and lint/build checks after removal.
- [Users cannot access existing tasks] -> Preserve documents for later export or rollback and call out the removal in release notes.
- [Concurrent calendar work can conflict] -> Complete and archive this change before responsive calendar implementation.

## Migration Plan

1. Remove task reads and UI entry points, then task state/handlers and components.
2. Verify event/preparation/travel-plan flows.
3. Deploy without deleting data; rollback restores code and immediately exposes unchanged tasks.
