import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketPulseSummary } from "./market-pulse-summary";

describe("MarketPulseSummary", () => {
  it("summarizes the leader, top three, and collecting progress", () => {
    render(
      <MarketPulseSummary
        postingCountLabel="1,771건 확인"
        topSkills={[
          { explicitCount: 330, name: "Python" },
          { explicitCount: 235, name: "AWS" },
          { explicitCount: 226, name: "LLM" },
        ]}
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
    expect(screen.getByText("Python · AWS · LLM")).toBeInTheDocument();
    expect(screen.getByText("2/4주 수집 중")).toBeInTheDocument();
  });
});
