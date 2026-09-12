const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarAuthError extends Error {}
export class GoogleCalendarSyncTokenExpiredError extends Error {}


async function calendarRequest(path, accessToken, params = {}, fetchImpl = fetch) {
  const url = new URL(`${CALENDAR_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 401) throw new GoogleCalendarAuthError("Google Calendarへ再接続してください");
  if (response.status === 410) throw new GoogleCalendarSyncTokenExpiredError("Google Calendarの同期tokenが失効しました");
  if (!response.ok) throw new Error(`Google Calendar APIがエラーを返しました (${response.status})`);
  return response.json();
}


export async function listGoogleCalendars(accessToken, fetchImpl = fetch) {
  const calendars = [];
  let pageToken = null;
  do {
    const data = await calendarRequest(
      "/users/me/calendarList",
      accessToken,
      { maxResults: 250, pageToken },
      fetchImpl,
    );
    calendars.push(
      ...(data.items ?? [])
        .filter((item) => !item.deleted && !item.hidden)
        .map((item) => ({
          id: item.id,
          summary: item.summaryOverride || item.summary || item.id,
          primary: Boolean(item.primary),
          time_zone: item.timeZone || null,
        })),
    );
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);
  return calendars;
}


async function hashText(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}


export async function googleEventDocumentId(calendarId, eventId) {
  return `google-${await hashText(`google-calendar\u0000${calendarId}\u0000${eventId}`)}`;
}


function localDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Google予定の日時が不正です");
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}


export async function normalizeGoogleEvent(calendar, event) {
  if (!calendar?.id || !event?.id) throw new Error("Google予定の識別情報が不足しています");
  const id = await googleEventDocumentId(calendar.id, event.id);
  const cancelled = event.status === "cancelled";
  const common = {
    id,
    source: "google_calendar",
    source_status: cancelled ? "cancelled" : "active",
    external: {
      provider: "google_calendar",
      calendar_id: calendar.id,
      event_id: event.id,
      recurring_event_id: event.recurringEventId || null,
      updated_at: event.updated || null,
      html_link: event.htmlLink || null,
      time_zone: event.start?.timeZone || calendar.time_zone || null,
      all_day: Boolean(event.start?.date),
    },
  };
  if (cancelled) return common;
  const allDay = Boolean(event.start?.date);
  const startAt = allDay
    ? `${event.start.date}T00:00`
    : localDateTime(event.start?.dateTime);
  const endAt = allDay
    ? `${event.end?.date || event.start.date}T00:00`
    : localDateTime(event.end?.dateTime);
  return {
    ...common,
    title: event.summary || "（無題）",
    start_at: startAt,
    end_at: endAt,
    description: event.description || "",
    location_name: event.location || null,
    external: {
      ...common.external,
      title: event.summary || "（無題）",
      start_at: startAt,
      end_at: endAt,
      description: event.description || "",
      location_name: event.location || null,
    },
  };
}

export function getGoogleCalendarStartupAction(integration, accessToken) {
  if (!(integration?.selected_calendars?.length > 0)) return "disconnected";
  return accessToken ? "sync" : "reconnect";
}


export async function fetchGoogleEventPages(
  calendar,
  accessToken,
  syncToken,
  fetchImpl = fetch,
) {
  const items = [];
  let pageToken = null;
  let nextSyncToken = null;
  do {
    const params = {
      singleEvents: true,
      showDeleted: true,
      maxResults: 2500,
      pageToken,
      syncToken: syncToken || null,
    };
    const data = await calendarRequest(
      `/calendars/${encodeURIComponent(calendar.id)}/events`,
      accessToken,
      params,
      fetchImpl,
    );
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken ?? null;
    nextSyncToken = data.nextSyncToken ?? nextSyncToken;
  } while (pageToken);
  if (!nextSyncToken) throw new Error("Google Calendar APIがnextSyncTokenを返しませんでした");
  return { items, nextSyncToken };
}


export async function syncGoogleCalendar({
  calendar,
  accessToken,
  syncToken = null,
  fetchImpl = fetch,
  listExistingEventIds = async () => [],
  writeEvents,
  commitSyncState,
  now = () => new Date().toISOString(),
}) {
  let pageResult;
  let wasFullSync = !syncToken;
  try {
    pageResult = await fetchGoogleEventPages(calendar, accessToken, syncToken, fetchImpl);
  } catch (error) {
    if (!(error instanceof GoogleCalendarSyncTokenExpiredError) || !syncToken) throw error;
    wasFullSync = true;
    pageResult = await fetchGoogleEventPages(calendar, accessToken, null, fetchImpl);
  }
  const normalized = await Promise.all(
    pageResult.items.map((event) => normalizeGoogleEvent(calendar, event)),
  );
  if (wasFullSync) {
    const receivedIds = new Set(normalized.map((event) => event.id));
    const missing = (await listExistingEventIds(calendar.id))
      .filter((id) => !receivedIds.has(id))
      .map((id) => ({ id, source_status: "cancelled" }));
    normalized.push(...missing);
  }
  await writeEvents(normalized);
  const syncState = {
    sync_token: pageResult.nextSyncToken,
    last_synced_at: now(),
  };
  await commitSyncState(calendar.id, syncState);
  return { events: normalized, syncState, wasFullSync };
}
