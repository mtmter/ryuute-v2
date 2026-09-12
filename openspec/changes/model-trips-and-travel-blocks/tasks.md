## 1. Data Model and Migration

- [x] 1.1 Add Firestore CRUD for trips, travel blocks and owner-based preparations, and verify frontend lint/build accept the service contract.
- [x] 1.2 Add deterministic non-destructive migration from legacy travel plans and verify repeated migration produces the same travel block IDs.
- [x] 1.3 Add event and Trip unlink/cascade operations plus route review marking, and verify all writes target only the signed-in user's collections.

## 2. Route Search Contract

- [x] 2.1 Generalize FastAPI route requests to PlaceRef plus arrival/departure timing while retaining the legacy request, and verify endpoint tests cover both shapes and validation.
- [x] 2.2 Pass the timing type through Mock and Ekispert providers and verify backend tests cover departure and arrival searches without live API calls.

## 3. Trip and Travel Block UI

- [x] 3.1 Add Trip and manual travel creation/detail flows, including Trip-owned preparations and deletion choices, and verify frontend lint/build pass.
- [x] 3.2 Replace the single travel plan section with multiple inbound/outbound travel blocks and independent search/register actions, and verify one event can retain both routes.
- [x] 3.3 Add travel block detail, edit and deletion behavior with provider, booking and review information, and verify all supported source types render.
- [x] 3.4 Add Trip itinerary consistency analysis and verify automated tests cover gaps, overlaps and place mismatches.

## 4. Calendar Integration

- [x] 4.1 Render travel blocks in month view as compact travel chips, including day popovers, and verify multi-day blocks appear on each date.
- [x] 4.2 Render travel blocks with events in week/day time grids, split overnight display, and verify overlap columns and warning states with automated utility tests.
- [x] 4.3 Hide trip-overview events from normal calendar views while retaining them in Trip detail, and verify calendar inputs are filtered consistently.

## 5. Verification and Documentation

- [x] 5.1 Update relevant setup and data-model documentation, and verify documented collections and request fields match implementation.
- [x] 5.2 Run strict OpenSpec validation, backend unit tests, frontend automated tests, lint and production build; resolve all failures.
