import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeTripItinerary,
  layoutCalendarItemsForDay,
  legacyTravelPlanToTravelBlock,
  routeToTravelBlock,
  visibleCalendarEvents,
} from "./travelUtils.js";

test("routeToTravelBlock keeps event direction and route metadata", () => {
  const block = routeToTravelBlock(
    {
      origin: "京都駅",
      destination: "嵐山",
      departure_at: "2026-09-12T13:00",
      arrival_at: "2026-09-12T13:30",
      duration_minutes: 30,
      transport_mode: "TRANSIT",
      provider: "transit",
      route_kind: "transit",
      is_fallback: false,
      notices: ["非公式情報"],
      segments: [],
    },
    { originEventId: "a", destinationEventId: "b", tripId: "trip" },
  );
  assert.equal(block.origin_event_id, "a");
  assert.equal(block.destination_event_id, "b");
  assert.equal(block.provider, "transit");
});

test("one event can own separate inbound and outbound travel blocks", () => {
  const route = {
    origin: "A",
    destination: "B",
    departure_at: "2026-09-12T10:00",
    arrival_at: "2026-09-12T11:00",
    duration_minutes: 60,
    transport_mode: "TRANSIT",
    segments: [],
  };
  const inbound = routeToTravelBlock(route, {
    destinationEventId: "event-1",
  });
  const outbound = routeToTravelBlock(route, {
    originEventId: "event-1",
  });
  assert.equal(inbound.destination_event_id, "event-1");
  assert.equal(inbound.origin_event_id, null);
  assert.equal(outbound.origin_event_id, "event-1");
  assert.equal(outbound.destination_event_id, null);
});

test("itinerary analysis reports gaps, overlaps and place mismatches", () => {
  const { warnings } = analyzeTripItinerary(
    [
      {
        id: "event-a",
        title: "京都駅",
        start_at: "2026-09-12T13:00",
        end_at: "2026-09-12T13:30",
        location_name: "京都駅",
      },
      {
        id: "event-b",
        title: "夕食",
        start_at: "2026-09-12T13:20",
        end_at: "2026-09-12T14:00",
        location_name: "四条",
      },
    ],
    [],
  );
  assert.ok(warnings.some((warning) => warning.type === "overlap"));
  assert.ok(warnings.some((warning) => warning.type === "place_mismatch"));

  const gapResult = analyzeTripItinerary(
    [
      { id: "a", title: "A", start_at: "2026-09-12T10:00", end_at: "2026-09-12T11:00" },
      { id: "b", title: "B", start_at: "2026-09-12T12:00", end_at: "2026-09-12T13:00" },
    ],
    [],
  );
  assert.ok(gapResult.warnings.some((warning) => warning.type === "gap"));
});

test("calendar layout splits overlaps into columns and supports overnight blocks", () => {
  const items = [
    { id: "event", start_at: "2026-09-12T23:00", end_at: "2026-09-13T01:00" },
    { id: "travel", start_at: "2026-09-12T23:30", end_at: "2026-09-13T00:30" },
  ];
  const firstDay = layoutCalendarItemsForDay(items, new Date(2026, 8, 12));
  const secondDay = layoutCalendarItemsForDay(items, new Date(2026, 8, 13));
  assert.equal(firstDay.length, 2);
  assert.equal(firstDay[0].columnCount, 2);
  assert.equal(secondDay.length, 2);
});

test("trip overview events are hidden from calendar inputs", () => {
  assert.deepEqual(
    visibleCalendarEvents([
      { id: "visible", calendar_visibility: "normal" },
      { id: "hidden", calendar_visibility: "trip_overview_hidden" },
    ]).map((event) => event.id),
    ["visible"],
  );
});

test("legacy travel migration uses a deterministic id and keeps route data", () => {
  const legacy = {
    id: "event-1",
    event_id: "event-1",
    origin: "京都駅",
    destination: "嵐山",
    departure_at: "2026-09-12T13:00",
    arrival_at: "2026-09-12T13:30",
    segments: [{ type: "TRANSIT" }],
  };
  const first = legacyTravelPlanToTravelBlock(legacy);
  const second = legacyTravelPlanToTravelBlock(legacy);
  assert.deepEqual(first, second);
  assert.equal(first.id, "legacy-event-1");
  assert.equal(first.destination_event_id, "event-1");
  assert.equal(first.segments.length, 1);
});
