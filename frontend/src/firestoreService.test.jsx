import { describe, expect, it } from "vitest";
import { SCHEDULE_COLLECTION_NAMES } from "./scheduleCollections";


describe("schedule loading collections", () => {
  it("does not read dormant task documents", () => {
    expect(SCHEDULE_COLLECTION_NAMES).toEqual([
      "events",
      "preparations",
      "trips",
      "travelBlocks",
      "travelPlans",
    ]);
    expect(SCHEDULE_COLLECTION_NAMES).not.toContain("tasks");
  });
});
