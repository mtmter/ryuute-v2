## Context

See proposal.md for motivation. The frontend currently loads events, tasks and preparations once, while a single `travelPlans/{eventId}` document is fetched from EventDetailsModal. Calendar components already split any object with `start_at` and `end_at` across days, but only accept events. Firestore access is user-scoped and no server-side migration facility exists.

## Goals / Non-Goals

**Goals:**

- Make events and travel blocks independent, composable calendar records.
- Keep legacy travel plans readable and migrate them without data loss.
- Keep route provider payloads out of Firestore/UI contracts except for the common Route snapshot.
- Detect itinerary inconsistencies without silently rewriting user data.

**Non-Goals:**

- Automatically composing searched and manually booked legs into one route.
- Automatically re-searching routes after schedule changes.
- Ticket inventory, payment, seat or reservation-number management.
- Implementing Google Calendar synchronization itself in this change.

## Decisions

1. Store Trip and travel block documents in sibling user collections. Events and preparations receive nullable relationship fields. This matches the existing direct Firestore architecture and keeps standalone events or travel blocks valid.
2. Always snapshot origin and destination inside a travel block, even when event relationships exist. This preserves a meaningful record when an event is deleted or imported data disappears.
3. A search-sourced travel block stores the complete common Route as flattened top-level fields plus segments. A manual block uses the same time/place fields but has no provider. This lets calendar code consume both without vendor-specific branches.
4. Use optional `origin_event_id` and `destination_event_id` rather than a single event ID plus direction. A route between two events can therefore reference both, while a return route can reference only its origin.
5. Load all travel blocks and trips with schedule data in v1. The existing app already loads complete user collections; range queries and pagination can be introduced later without changing document shape.
6. Represent calendar entries with their original records and compute collision columns per day. The same overlap layout is shared by events and travel blocks, and multi-day records are clipped by existing date utilities.
7. Use a deterministic legacy document ID `legacy-{eventId}` and `setDoc` without deleting the source. Migration runs after schedule load and merges newly created blocks into local state. This is idempotent and permits rollback to the old UI.
8. Generalize `/api/route-search` with `PlaceRef` and `timing`, while retaining the legacy request body as an optional compatibility branch. Backend orchestration receives `time_type` so Provider work can implement departure search without another public API change.
9. Event update compares timing and location fields. Any linked block is patched with `needs_review: true` and machine-readable reason strings; existing route snapshots remain untouched.
10. User-driven event/Trip deletion presents explicit retention versus cascade choices. Trip retention unlinks events and travel blocks but deletes Trip-owned preparations because they have no valid owner after the Trip is removed. Imported Google deletion will call the event unlink operation without prompting when that integration is implemented.
11. Trip consistency is a pure function over chronologically sorted children. Positive time gaps, overlaps, and adjacent place labels that do not normalize to the same string create warnings; warnings never block persistence.

## Risks / Trade-offs

- [Loading complete collections will not scale indefinitely] → Keep service boundaries collection-specific so range queries can replace the implementation later.
- [Text-based place matching can report false mismatches] → Treat it as a warning only and prefer normalized addresses or coordinates when both exist.
- [Client-side multi-document operations are not fully atomic when queries precede a batch] → Resolve exact references first and commit all writes/deletes in one Firestore batch.
- [Legacy migration can fail independently of schedule loading] → Continue showing the application, report the migration error, and leave the source document unchanged for retry.
- [Concurrent clients may repeat migration] → Deterministic IDs make repeated writes converge on the same document.

## Migration Plan

1. Deploy backward-compatible API request parsing and Firestore service methods.
2. Load `trips`, `travelBlocks`, and legacy `travelPlans`; create missing deterministic legacy blocks.
3. Switch event detail and calendars to travel blocks while retaining old documents.
4. Verify migrated records before any later change removes legacy reads. Roll back by restoring the old UI because legacy documents remain untouched.
