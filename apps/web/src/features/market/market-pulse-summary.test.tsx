import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketPulseSummary } from "./market-pulse-summary";

describe("MarketPulseSummary", () => {
  it("summarizes the leader, analysis scope, and collecting progress without repeating the ranking", () => {
    render(
      <MarketPulseSummary
        leader={{ explicitCount: 330, name: "Python" }}
        postingTotal={1771}
        skillTotal={69}
        trendResource={{
          status: "ready",
          data: {
            status: "collecting",
            collected_weeks: 2,
            minimum_weeks: 4,
            latest_snapshot_at: null,
            series: [],
          },
        }}
        verifiedLabel="2026. 7. 22."
      />,
    );

    expect(screen.getByText("Python · 330건")).toBeInTheDocument();
    expect(screen.getByText("명시 요구 1위")).toBeInTheDocument();
    expect(screen.getByText("1,771건 · 69종")).toBeInTheDocument();
    expect(screen.getByText("2/4주 수집 중")).toBeInTheDocument();
    expect(screen.queryByText("Python · AWS · LLM")).not.toBeInTheDocument();
  });
});
