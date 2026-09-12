import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  batchDelete: vi.fn(), batchSet: vi.fn(), commit: vi.fn(), doc: vi.fn((...args) => args),
  getDoc: vi.fn(), getDocs: vi.fn(), setDoc: vi.fn(), transactionSet: vi.fn(),
}));

vi.mock("./firebase", () => ({ db: "db" }));
vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(), collection: vi.fn((...args) => args), deleteDoc: vi.fn(),
  doc: mocks.doc, getDoc: mocks.getDoc, getDocs: mocks.getDocs,
  query: vi.fn((...args) => args), runTransaction: vi.fn(async (_db, callback) => callback({
    get: mocks.getDoc, set: mocks.transactionSet,
  })), setDoc: mocks.setDoc, updateDoc: vi.fn(), where: vi.fn((...args) => args),
  writeBatch: vi.fn(() => ({
    delete: mocks.batchDelete, set: mocks.batchSet, update: vi.fn(), commit: mocks.commit,
  })),
}));

import {
  getGoogleCalendarIntegration,
  saveGoogleCalendarSyncState,
  writeGoogleCalendarEvents,
} from "./firestoreService";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.commit.mockResolvedValue(undefined);
});

describe("Google Calendar Firestore service", () => {
  it("reads and transactionally updates the user-scoped integration document without credentials", async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({
      selected_calendars: [{ id: "main", summary: "Main" }],
      sync_state: {}, access_token: "must-not-survive",
    }) });
    const integration = await getGoogleCalendarIntegration("u1");
    expect(mocks.doc).toHaveBeenCalledWith("db", "users", "u1", "integrations", "googleCalendar");
    expect(integration).not.toHaveProperty("access_token");
    await saveGoogleCalendarSyncState("u1", "main", { sync_token: "next" });
    expect(JSON.stringify(mocks.transactionSet.mock.calls[0][1])).not.toContain("must-not-survive");
  });

  it("merges cancellations into event documents without cascade deletion", async () => {
    await writeGoogleCalendarEvents("u1", [{ id: "google-event", source_status: "cancelled" }]);
    expect(mocks.batchSet).toHaveBeenCalledWith(
      expect.anything(),
      { source_status: "cancelled" },
      { merge: true },
    );
    expect(mocks.batchDelete).not.toHaveBeenCalled();
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
});
