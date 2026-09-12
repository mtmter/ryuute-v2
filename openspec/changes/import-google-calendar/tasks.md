## 1. Authorization and Integration State

- [ ] 1.1 Add Google Identity Services loading and in-memory Calendar token handling, and verify unit tests cover connect, denial, expiry and reconnect states without persisting tokens.
- [ ] 1.2 Add Firestore integration settings read/write for selected calendars and sync metadata, and verify user-scoped paths and token exclusion in service tests.
- [ ] 1.3 Add connection, disconnection and calendar-selection UI with primary selected by default, and verify component tests cover each state.

## 2. Calendar Synchronization

- [ ] 2.1 Implement pure normalization for timed, all-day, recurring and cancelled Google events with deterministic hashed local IDs, and verify fixture tests cover timezone boundaries.
- [ ] 2.2 Implement full paginated sync, chunked Firestore writes and final sync-token commit, and verify partial failures do not advance the token.
- [ ] 2.3 Implement incremental sync and HTTP 410 full-resync recovery, and verify changed, deleted and expired-token fixtures.
- [ ] 2.4 Trigger sync on explicit update and when a valid in-memory token exists during app startup, and verify an expired/missing token only shows reconnect guidance.

## 3. Calendar and Event Experience

- [ ] 3.1 Merge active imported events into calendar views with a source indicator, and verify cancelled events are hidden.
- [ ] 3.2 Make Google-owned fields read-only while retaining local destination augmentation, arrival buffer, preparations and travel plans, and verify edit/detail tests cover the boundary.
- [ ] 3.3 Preserve preparations and travel plans when an imported event is cancelled, and verify Firestore integration tests prevent cascade deletion during sync.

## 4. Configuration and Verification

- [ ] 4.1 Add `VITE_GOOGLE_OAUTH_CLIENT_ID` and document Google Cloud consent, scope and authorized-origin setup; verify env examples match runtime lookup.
- [ ] 4.2 Run frontend unit tests, lint/build and backend tests, then manually verify connect, calendar selection, full sync, incremental sync and reconnect in a configured environment.
