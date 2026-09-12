import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCalendarAccessToken,
  connectGoogleCalendar,
  getCalendarAccessToken,
  setCalendarTokenForTest,
} from "./googleCalendarAuth";

afterEach(() => {
  clearCalendarAccessToken();
  delete globalThis.google;
  vi.restoreAllMocks();
});

describe("Google Calendar authorization", () => {
  it("keeps an accepted token only in module memory", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    globalThis.google = { accounts: { oauth2: { initTokenClient: (options) => ({
      requestAccessToken: () => options.callback({ access_token: "memory-token", expires_in: 3600 }),
    }) } } };
    await expect(connectGoogleCalendar("client", { load: vi.fn(), now: () => 1000 })).resolves.toBe("memory-token");
    expect(getCalendarAccessToken(2000)).toBe("memory-token");
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("rejects denial and clears the token", async () => {
    globalThis.google = { accounts: { oauth2: { initTokenClient: (options) => ({
      requestAccessToken: () => options.callback({ error: "access_denied" }),
    }) } } };
    await expect(connectGoogleCalendar("client", { load: vi.fn() })).rejects.toThrow("認可が拒否");
    expect(getCalendarAccessToken()).toBeNull();
  });

  it("turns an expired token into a reconnect state", () => {
    setCalendarTokenForTest("expired", 1000);
    expect(getCalendarAccessToken(1000)).toBeNull();
  });
});
