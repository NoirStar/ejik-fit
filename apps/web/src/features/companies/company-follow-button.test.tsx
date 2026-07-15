import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CompanyFollowButton } from "./company-follow-button";

describe("CompanyFollowButton", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("persists a followed company and exposes an honest pressed state", async () => {
    render(<CompanyFollowButton companyName="네이버" companySlug="naver" />);

    const saveButton = await screen.findByRole("button", {
      name: "네이버 관심 기업으로 저장",
    });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    expect(
      screen.getByRole("button", { name: "네이버 관심 기업에서 제거" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      JSON.parse(
        window.localStorage.getItem("ejik-fit:followed-company-slugs")!,
      ),
    ).toEqual(["naver"]);
  });
});
