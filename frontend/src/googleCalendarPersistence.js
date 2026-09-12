export const GOOGLE_INTEGRATION_DOCUMENT = ["integrations", "googleCalendar"];
export const FIRESTORE_BATCH_LIMIT = 450;

export function defaultSelectedCalendarIds(calendars, savedIds = []) {
  if (savedIds.length > 0) return savedIds;
  const primary = calendars.find((calendar) => calendar.primary);
  return primary ? [primary.id] : [];
}

const GOOGLE_LOCAL_EVENT_FIELDS = new Set([
  "destination",
  "destination_place_id",
  "destination_lat",
  "destination_lng",
  "arrival_buffer_minutes",
  "trip_id",
  "calendar_visibility",
]);

export function writableGoogleEventData(eventData) {
  return Object.fromEntries(
    Object.entries(eventData).filter(([field]) => GOOGLE_LOCAL_EVENT_FIELDS.has(field)),
  );
}


export function googleIntegrationPath(uid) {
  return ["users", String(uid), ...GOOGLE_INTEGRATION_DOCUMENT];
}


export function sanitizeGoogleIntegration(settings = {}) {
  const selectedCalendars = Array.isArray(settings.selected_calendars)
    ? settings.selected_calendars.map((calendar) => ({
        id: String(calendar.id),
        summary: String(calendar.summary || calendar.id),
        primary: Boolean(calendar.primary),
        time_zone: calendar.time_zone || null,
      }))
    : [];
  const syncState = {};
  for (const [calendarId, state] of Object.entries(settings.sync_state ?? {})) {
    syncState[calendarId] = {
      sync_token: state?.sync_token || null,
      last_synced_at: state?.last_synced_at || null,
    };
  }
  return { selected_calendars: selectedCalendars, sync_state: syncState };
}


export function chunkFirestoreWrites(items, size = FIRESTORE_BATCH_LIMIT) {
  if (!Number.isInteger(size) || size < 1 || size > 500) {
    throw new Error("Firestore batch sizeが不正です");
  }
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
