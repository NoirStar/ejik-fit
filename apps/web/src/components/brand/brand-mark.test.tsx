import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  afterEach(() => cleanup());

  it("renders one consistent Korean CareerFit wordmark", () => {
    const { container } = render(<BrandMark size="sm" />);

    expect(screen.getByText("커리어핏")).toBeInTheDocument();
    expect(container.querySelector(".brand-lockup__mark")).toHaveTextContent("C");
    expect(screen.queryByText("EJIK FIT")).not.toBeInTheDocument();
  });

  it("keeps the compact mark when the full wordmark is disabled", () => {
    const { container } = render(<BrandMark showWordmark={false} />);

    expect(container.querySelector(".brand-lockup__mark")).toHaveTextContent("C");
    expect(screen.queryByText("커리어핏")).not.toBeInTheDocument();
  });
});
