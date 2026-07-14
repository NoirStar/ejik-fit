import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  afterEach(() => cleanup());

  it("renders the approved Korean wordmark without the old symbol or English subtitle", () => {
    const { container } = render(<BrandMark size="sm" />);

    const asset = container.querySelector("img.brand-lockup__asset");

    expect(asset).toHaveAttribute("src", "/brand/ejik-fit-wordmark.svg");
    expect(asset).toHaveAttribute("alt", "");
    expect(screen.queryByText("EJIK FIT")).not.toBeInTheDocument();
    expect(container.querySelector(".brand-lockup__mark")).not.toBeInTheDocument();
  });

  it("uses outlined fixed assets instead of browser-rendered font text", () => {
    const wordmarkPath = resolve(
      process.cwd(),
      "public/brand/ejik-fit-wordmark.svg",
    );
    expect(existsSync(wordmarkPath)).toBe(true);

    const wordmark = readFileSync(wordmarkPath, "utf8");
    expect(wordmark).toContain("<path");
    expect(wordmark).toContain("#17171c");
    expect(wordmark).toContain("#6d4be8");
    expect(wordmark).not.toContain("<text");
  });

  it("keeps a fixed compact fit glyph when the full wordmark is disabled", () => {
    const { container } = render(<BrandMark showWordmark={false} />);

    expect(container.querySelector("img.brand-lockup__asset")).toHaveAttribute(
      "src",
      "/brand/ejik-fit-glyph.svg",
    );
  });
});
