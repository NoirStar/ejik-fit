import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  afterEach(() => cleanup());

  it("renders the approved Korean wordmark without the old symbol or English subtitle", () => {
    const { container } = render(<BrandMark size="sm" />);

    expect(screen.getByText("이직")).toBeInTheDocument();
    expect(screen.getByText("핏")).toBeInTheDocument();
    expect(screen.queryByText("EJIK FIT")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector(".brand-lockup__mark")).not.toBeInTheDocument();
  });

  it("keeps a compact fit glyph when the full wordmark is disabled", () => {
    render(<BrandMark showWordmark={false} />);

    expect(screen.queryByText("이직")).not.toBeInTheDocument();
    expect(screen.getByText("핏")).toBeInTheDocument();
  });
});
