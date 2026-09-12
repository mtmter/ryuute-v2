import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GoogleCalendarSettings from "./GoogleCalendarSettings";

afterEach(cleanup);

describe("GoogleCalendarSettings", () => {
  it("shows connect and reconnect states", () => {
    const { rerender } = render(<GoogleCalendarSettings onConnect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "接続" })).toBeTruthy();
    rerender(<GoogleCalendarSettings status="reconnect" onConnect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "再接続" })).toBeTruthy();
    expect(screen.getByText(/同期を再開/)).toBeTruthy();
  });

  it("changes selection, syncs and disconnects", () => {
    const onSelectionChange = vi.fn();
    const onSync = vi.fn();
    const onDisconnect = vi.fn();
    render(<GoogleCalendarSettings
      calendars={[{ id: "main", summary: "Main", primary: true }, { id: "work", summary: "Work" }]}
      selectedIds={["main"]}
      status="connected"
      onSelectionChange={onSelectionChange}
      onSync={onSync}
      onDisconnect={onDisconnect}
    />);
    fireEvent.click(screen.getByLabelText("Work"));
    expect(onSelectionChange).toHaveBeenCalledWith(["main", "work"]);
    fireEvent.click(screen.getByRole("button", { name: "今すぐ同期" }));
    fireEvent.click(screen.getByRole("button", { name: "切断" }));
    expect(onSync).toHaveBeenCalled();
    expect(onDisconnect).toHaveBeenCalled();
  });
});
