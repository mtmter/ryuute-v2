import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RouteSearchResult from "./RouteSearchResult";


const baseRoute = {
  origin: "京都駅",
  destination: "嵐山",
  departure_at: "2026-09-12T13:00",
  arrival_at: "2026-09-12T13:30",
  duration_minutes: 30,
  transport_mode: "TRANSIT",
  provider: "transit",
  route_kind: "transit",
  is_fallback: false,
  notices: ["重要な移動は交通事業者の案内も確認してください。"],
  segments: [
    {
      type: "TRANSIT",
      from: "京都駅",
      to: "嵐山",
      departure_at: "2026-09-12T13:00",
      arrival_at: "2026-09-12T13:30",
      duration_minutes: 30,
      line_name: "嵯峨野線",
    },
  ],
};


afterEach(cleanup);


describe("RouteSearchResult provider metadata", () => {
  it("shows Transit attribution and notices", () => {
    render(<RouteSearchResult route={baseRoute} />);

    expect(screen.getByText("Transit APIによる非公式情報")).toBeTruthy();
    expect(
      screen.getByText("重要な移動は交通事業者の案内も確認してください。"),
    ).toBeTruthy();
  });

  it("identifies Google walking fallback", () => {
    render(
      <RouteSearchResult
        route={{
          ...baseRoute,
          provider: "google",
          route_kind: "walk",
          transport_mode: "WALK",
          is_fallback: true,
          notices: [],
          segments: [
            {
              ...baseRoute.segments[0],
              type: "WALK",
              line_name: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Google徒歩ルート")).toBeTruthy();
    expect(screen.getByText("代替経路として検索されました")).toBeTruthy();
  });
});
