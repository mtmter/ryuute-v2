## 1. Data and State

- [ ] 1.1 Remove task collection loading and task CRUD exports from active frontend data flow, and verify schedule loading requests only events and preparations.
- [ ] 1.2 Remove task state, handlers and selected-task behavior from App, and verify repository searches find no active task references.

## 2. User Interface

- [ ] 2.1 Make item creation event-only and remove the task navigation tab, and verify event creation defaults and submission still work.
- [ ] 2.2 Remove task inputs/rendering from Month, Week and Day calendars, and verify each view renders event-only data.
- [ ] 2.3 Delete task-only components and unused CSS while retaining shared styles, and verify lint reports no unused imports or selectors referenced by surviving components.

## 3. Compatibility and Documentation

- [ ] 3.1 Confirm no migration or delete operation targets `users/{uid}/tasks`, and verify Firestore rules remain unchanged.
- [ ] 3.2 Update README, architecture and current specs after implementation, documenting that existing task data remains untouched.
- [ ] 3.3 Run frontend lint/build and backend tests, and manually verify event, preparation and travel-plan flows.
