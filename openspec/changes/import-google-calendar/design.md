## Context

Firebase Authentication currently signs in with Google for identity only. Events are user-scoped Firestore documents with local editable fields; preparations reference an event ID and travel plans use the event ID as document ID. Calendar API authorization therefore needs a separate lifecycle and imported events need stable local IDs.

## Goals / Non-Goals

**Goals:**

- Sync selected Google calendars without storing OAuth credentials.
- Preserve stable event IDs so existing preparation and travel-plan relations work.
- Keep source-owned fields read-only while allowing local augmentation.

**Non-Goals:**

- Server-side refresh tokens, background jobs, push channels or write access to Google.
- Perfectly silent startup sync after a browser token expires.

## Decisions

1. Load Google Identity Services on demand and request `calendar.readonly` through a separate Connect action. Keep the access token in module memory only. Startup sync runs only while a valid in-memory token exists; otherwise the UI shows Reconnect without opening an unsolicited popup.
2. Persist one integration document at `users/{uid}/integrations/googleCalendar` containing selected calendar descriptors, per-calendar sync tokens and last sync metadata. Never write access tokens.
3. Mirror imported instances into `events` with a deterministic local document ID derived from provider, calendar ID and Google event ID. Store source-owned fields under `external`, local augmentations in existing top-level Ryuute fields, and `source_status` for active/cancelled.
4. Request `singleEvents=true` so recurring instances display as normal events. Normalize timed and all-day events to the app's local date representation while preserving source timezone and all-day markers for future rendering.
5. Sync calendars sequentially to simplify token commits. Process all pages in memory, batch event upserts/status changes, then commit the new sync token; never advance a token before event writes succeed.
6. On HTTP 410 clear only that calendar's sync token and perform a fresh full sync. Mark previously mirrored events from that calendar cancelled when absent from the full snapshot, without deleting related local records.
7. Source title/start/end/description/location render read-only. Arrival buffer, resolved destination coordinates, preparations and travel plans remain local and editable.

## Risks / Trade-offs

- [Browser token expiry interrupts automatic sync] -> Display connection state and provide a single explicit reconnect-and-sync action.
- [Large calendars can exceed Firestore batch limits] -> Chunk writes and update the sync token only after every chunk succeeds.
- [Deterministic IDs may expose source identifiers] -> Hash the composite identifier rather than storing it as the document path; retain raw identifiers inside the user-protected document for API calls.
- [Concurrent tabs can race sync tokens] -> Compare stored token/update metadata before the final integration write and let a newer completed sync win.

## Migration Plan

1. Add integration persistence and pure Google response normalization tests.
2. Add opt-in connection UI and sync without changing local events.
3. Enable imported event rendering and read-only detail behavior.
4. Roll back by hiding/disabling the integration entry point; imported documents remain user-scoped and can be ignored by source type.
