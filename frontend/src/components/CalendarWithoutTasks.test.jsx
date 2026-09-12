import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AddItemModal from "./AddItemModal";
import DayCalendar from "./DayCalendar";
import MonthCalendar from "./MonthCalendar";
import WeekCalendar from "./WeekCalendar";


const selectedDate = new Date(2026, 8, 12);
const event = {
  id: "event-1",
  title: "予定だけ表示",
  start_at: "2026-09-12T10:00",
  end_at: "2026-09-12T11:00",
};

afterEach(cleanup);

describe("event-focused calendars", () => {
  it.each([
    ["month", MonthCalendar],
    ["week", WeekCalendar],
    ["day", DayCalendar],
  ])("renders events in %s view without a task input", (_name, Component) => {
    render(
      <Component
        events={[event]}
        travelBlocks={[]}
        selectedDate={selectedDate}
        onDateClick={vi.fn()}
        onEventClick={vi.fn()}
        onTravelBlockClick={vi.fn()}
        onTimeClick={vi.fn()}
      />,
    );

    expect(screen.getByText("予定だけ表示")).toBeTruthy();
    expect(screen.queryByText("タスク")).toBeNull();
  });

  it("marks Google events and hides cancelled imports", () => {
    render(
      <MonthCalendar
        events={[
          { ...event, id: "google-active", title: "外部予定", source: "google_calendar" },
          { ...event, id: "google-cancelled", title: "取消予定", source: "google_calendar", source_status: "cancelled" },
        ].filter((item) => item.source_status !== "cancelled")}
        travelBlocks={[]}
        selectedDate={selectedDate}
        onDateClick={vi.fn()}
        onEventClick={vi.fn()}
        onTravelBlockClick={vi.fn()}
      />,
    );
    expect(screen.getByText("G 外部予定")).toBeTruthy();
    expect(screen.queryByText(/取消予定/)).toBeNull();
  });
});

describe("AddItemModal", () => {
  it("has no generic task choice and submits an event", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddItemModal
        initialValues={{
          itemType: "event",
          eventStartAt: "2026-09-12T10:00",
          eventEndAt: "2026-09-12T11:00",
        }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.queryByRole("button", { name: "タスク" })).toBeNull();
    fireEvent.change(screen.getByLabelText("予定タイトル"), {
      target: { value: "打ち合わせ" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(onSubmit).toHaveBeenCalledWith(
      "event",
      expect.objectContaining({ title: "打ち合わせ" }),
    );
  });
});
