import {
  eventOccursOnDate,
  getEventPositionForDay,
  parseDateTime,
} from "./dateUtils.js";

export function getPlaceLabel(place) {
  if (!place) return "未設定";
  if (typeof place === "string") return place || "未設定";
  return (
    place.name ||
    place.address ||
    (place.lat != null && place.lng != null
      ? `${place.lat}, ${place.lng}`
      : "未設定")
  );
}

export function normalizePlace(value, fallbackName = "") {
  if (value && typeof value === "object") {
    return {
      name: value.name ?? fallbackName,
      address: value.address ?? null,
      place_id: value.place_id ?? null,
      lat: value.lat ?? null,
      lng: value.lng ?? null,
    };
  }
  return {
    name: value || fallbackName,
    address: null,
    place_id: null,
    lat: null,
    lng: null,
  };
}

export function legacyTravelPlanToTravelBlock(travelPlan) {
  const eventId = String(travelPlan.event_id ?? travelPlan.id);
  return {
    id: `legacy-${eventId}`,
    title: `${travelPlan.origin || "出発地"} → ${travelPlan.destination || "目的地"}`,
    start_at: travelPlan.departure_at,
    end_at: travelPlan.arrival_at,
    origin: normalizePlace(travelPlan.origin),
    destination: normalizePlace(travelPlan.destination),
    source_type: "route_search",
    transport_mode: travelPlan.transport_mode ?? "TRANSIT",
    booking_status: "planned",
    trip_id: null,
    origin_event_id: null,
    destination_event_id: eventId,
    provider: travelPlan.provider ?? "legacy",
    route_kind:
      travelPlan.route_kind ??
      (travelPlan.transport_mode === "WALK" ? "walk" : "transit"),
    is_fallback: travelPlan.is_fallback ?? false,
    notices: travelPlan.notices ?? ["旧形式の移動予定から移行しました"],
    segments: travelPlan.segments ?? [],
    duration_minutes: travelPlan.duration_minutes ?? null,
    needs_review: false,
    review_reasons: [],
    legacy_travel_plan_id: String(travelPlan.id ?? eventId),
  };
}

export function eventToPlace(event) {
  return {
    name: event.location_name || event.destination || "",
    address: event.destination ?? null,
    place_id: event.destination_place_id ?? null,
    lat: event.destination_lat ?? null,
    lng: event.destination_lng ?? null,
  };
}

export function routeToTravelBlock(route, options = {}) {
  const origin = options.origin ?? { name: route.origin };
  const destination = options.destination ?? { name: route.destination };
  return {
    title: `${getPlaceLabel(origin)} → ${getPlaceLabel(destination)}`,
    start_at: route.departure_at,
    end_at: route.arrival_at,
    origin,
    destination,
    source_type: "route_search",
    transport_mode: route.transport_mode,
    booking_status: "planned",
    trip_id: options.tripId ?? null,
    origin_event_id: options.originEventId ?? null,
    destination_event_id: options.destinationEventId ?? null,
    provider: route.provider ?? "legacy",
    route_kind:
      route.route_kind ??
      (route.transport_mode === "WALK" ? "walk" : "transit"),
    is_fallback: route.is_fallback ?? false,
    notices: route.notices ?? [],
    segments: route.segments ?? [],
    duration_minutes: route.duration_minutes,
    needs_review: false,
    review_reasons: [],
  };
}

function normalizedPlaceKey(place) {
  if (!place) return "";
  if (place.lat != null && place.lng != null) {
    return `${Number(place.lat).toFixed(4)},${Number(place.lng).toFixed(4)}`;
  }
  return String(place.address || place.name || place)
    .toLocaleLowerCase("ja")
    .replace(/[\s\u3000]/g, "");
}

function itemPlaces(item) {
  if (item.calendar_kind === "travel") {
    return { start: item.origin, end: item.destination };
  }
  const place = eventToPlace(item);
  return { start: place, end: place };
}

export function analyzeTripItinerary(events, travelBlocks) {
  const items = [
    ...events.map((event) => ({ ...event, calendar_kind: "event" })),
    ...travelBlocks.map((block) => ({ ...block, calendar_kind: "travel" })),
  ]
    .filter((item) => parseDateTime(item.start_at))
    .sort((first, second) => first.start_at.localeCompare(second.start_at));
  const warnings = [];

  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    const previousEnd = parseDateTime(previous.end_at) ?? parseDateTime(previous.start_at);
    const currentStart = parseDateTime(current.start_at);
    if (currentStart < previousEnd) {
      warnings.push({ type: "overlap", previousId: previous.id, currentId: current.id });
    } else if (currentStart > previousEnd) {
      warnings.push({
        type: "gap",
        previousId: previous.id,
        currentId: current.id,
        minutes: Math.round((currentStart - previousEnd) / 60000),
      });
    }

    const previousPlace = normalizedPlaceKey(itemPlaces(previous).end);
    const currentPlace = normalizedPlaceKey(itemPlaces(current).start);
    if (previousPlace && currentPlace && previousPlace !== currentPlace) {
      warnings.push({
        type: "place_mismatch",
        previousId: previous.id,
        currentId: current.id,
      });
    }
  }
  return { items, warnings };
}

export function layoutCalendarItemsForDay(items, date) {
  const visible = items
    .filter((item) => eventOccursOnDate(item, date))
    .map((item) => ({ ...item, position: getEventPositionForDay(item, date) }))
    .sort(
      (first, second) =>
        first.position.startMinutes - second.position.startMinutes ||
        second.position.durationMinutes - first.position.durationMinutes,
    );

  const clusters = [];
  visible.forEach((item) => {
    const end = item.position.startMinutes + item.position.durationMinutes;
    const cluster = clusters.at(-1);
    if (!cluster || item.position.startMinutes >= cluster.end) {
      clusters.push({ end, items: [item] });
    } else {
      cluster.items.push(item);
      cluster.end = Math.max(cluster.end, end);
    }
  });

  return clusters.flatMap((cluster) => {
    const columnEnds = [];
    const assigned = cluster.items.map((item) => {
      const start = item.position.startMinutes;
      let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = start + item.position.durationMinutes;
      return { ...item, column };
    });
    const columnCount = columnEnds.length;
    return assigned.map((item) => ({
      ...item,
      columnCount,
      hasOverlap: columnCount > 1,
      leftPercent: (item.column / columnCount) * 100,
      widthPercent: 100 / columnCount,
    }));
  });
}

export function visibleCalendarEvents(events) {
  return events.filter(
    (event) =>
      event.calendar_visibility !== "trip_overview_hidden" &&
      event.source_status !== "cancelled",
  );
}
