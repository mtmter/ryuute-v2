import { describe, expect, it } from "vitest";
import {
  chunkFirestoreWrites,
  defaultSelectedCalendarIds,
  googleIntegrationPath,
  sanitizeGoogleIntegration,
  writableGoogleEventData,
} from "./googleCalendarPersistence";

describe("Google Calendar integration persistence", () => {
  it("uses a user-scoped document and excludes credentials", () => {
    expect(googleIntegrationPath("user-1")).toEqual(["users", "user-1", "integrations", "googleCalendar"]);
    const value = sanitizeGoogleIntegration({
      access_token: "secret",
      refresh_token: "secret",
      selected_calendars: [{ id: "primary", summary: "Main", primary: true, token: "secret" }],
      sync_state: { primary: { sync_token: "sync-only", access_token: "secret" } },
    });
    expect(JSON.stringify(value)).not.toContain("secret");
    expect(value.sync_state.primary.sync_token).toBe("sync-only");
  });

  it("allows local augmentation but rejects Google-owned field updates", () => {
    expect(writableGoogleEventData({
      title: "overwrite",
      start_at: "overwrite",
      description: "overwrite",
      location_name: "overwrite",
      destination: "local address",
      arrival_buffer_minutes: 15,
      trip_id: "trip-1",
    })).toEqual({ destination: "local address", arrival_buffer_minutes: 15, trip_id: "trip-1" });
  });

  it("selects the primary calendar by default and chunks writes", () => {
    expect(defaultSelectedCalendarIds([{ id: "other" }, { id: "main", primary: true }])).toEqual(["main"]);
    expect(chunkFirestoreWrites([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
