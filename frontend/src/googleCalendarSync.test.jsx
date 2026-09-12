import { describe, expect, it, vi } from "vitest";
import {
  fetchGoogleEventPages,
  getGoogleCalendarStartupAction,
  googleEventDocumentId,
  normalizeGoogleEvent,
  syncGoogleCalendar,
} from "./googleCalendarSync";

const calendar = { id: "primary", summary: "Main", time_zone: "Asia/Tokyo" };
const jsonResponse = (body, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("Google event normalization", () => {
  it("normalizes timed, recurring, all-day and cancelled events", async () => {
    const timed = await normalizeGoogleEvent(calendar, {
      id: "instance-1", recurringEventId: "series-1", summary: "Meeting",
      start: { dateTime: "2026-01-01T15:30:00Z", timeZone: "Asia/Tokyo" },
      end: { dateTime: "2026-01-01T16:30:00Z" }, location: "Tokyo",
    });
    expect(timed.start_at).toBe("2026-01-02T00:30");
    expect(timed.external.recurring_event_id).toBe("series-1");
    expect(timed.id).toBe(await googleEventDocumentId("primary", "instance-1"));

    const allDay = await normalizeGoogleEvent(calendar, { id: "all-day", start: { date: "2026-02-03" }, end: { date: "2026-02-04" } });
    expect(allDay.start_at).toBe("2026-02-03T00:00");
    expect(allDay.external.all_day).toBe(true);

    const cancelled = await normalizeGoogleEvent(calendar, { id: "gone", status: "cancelled" });
    expect(cancelled).toMatchObject({ source_status: "cancelled", source: "google_calendar" });
    expect(cancelled).not.toHaveProperty("title");
  });
});

describe("Google Calendar synchronization", () => {
  it("paginates and sends a sync token only for incremental sync", async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => jsonResponse({ items: [{ id: "one" }], nextPageToken: "page-2" }))
      .mockImplementationOnce(() => jsonResponse({ items: [{ id: "two" }], nextSyncToken: "next" }));
    const result = await fetchGoogleEventPages(calendar, "access", "current", fetchImpl);
    expect(result.items).toHaveLength(2);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("syncToken=current");
    expect(String(fetchImpl.mock.calls[1][0])).toContain("pageToken=page-2");
  });

  it("does not advance the token when event writes fail", async () => {
    const commitSyncState = vi.fn();
    await expect(syncGoogleCalendar({
      calendar, accessToken: "access", fetchImpl: () => jsonResponse({ items: [], nextSyncToken: "next" }),
      writeEvents: vi.fn().mockRejectedValue(new Error("partial write")), commitSyncState,
    })).rejects.toThrow("partial write");
    expect(commitSyncState).not.toHaveBeenCalled();
  });

  it("recovers from HTTP 410 with a full sync and cancels absent local events", async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => jsonResponse({}, 410))
      .mockImplementationOnce(() => jsonResponse({ items: [{ id: "fresh", summary: "Changed", start: { date: "2026-03-01" }, end: { date: "2026-03-02" } }], nextSyncToken: "replacement" }));
    const writeEvents = vi.fn();
    const result = await syncGoogleCalendar({
      calendar, accessToken: "access", syncToken: "expired", fetchImpl,
      listExistingEventIds: async () => ["missing-local"], writeEvents, commitSyncState: vi.fn(),
    });
    expect(result.wasFullSync).toBe(true);
    expect(writeEvents.mock.calls[0][0]).toContainEqual({ id: "missing-local", source_status: "cancelled" });
    expect(String(fetchImpl.mock.calls[1][0])).not.toContain("syncToken=");
  });

  it("chooses startup sync only for a selected calendar and valid memory token", () => {
    const integration = { selected_calendars: [calendar] };
    expect(getGoogleCalendarStartupAction(integration, "valid")).toBe("sync");
    expect(getGoogleCalendarStartupAction(integration, null)).toBe("reconnect");
    expect(getGoogleCalendarStartupAction({ selected_calendars: [] }, null)).toBe("disconnected");
  });
});
