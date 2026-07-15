import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompanyMark } from "./company-mark";

describe("CompanyMark", () => {
  it("falls back to initials when a verified local image fails", () => {
    const { container } = render(
      <CompanyMark
        companyName="NAVER"
        sourceUrl="https://recruit.navercorp.com/jobs/1"
      />,
    );
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");

    fireEvent.error(image!);

    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("NA");
  });

  it("detects an image that failed before hydration attached its error handler", async () => {
    const complete = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "complete",
    );
    const naturalWidth = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "naturalWidth",
    );
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get: () => 0,
    });

    try {
      const { container } = render(
        <CompanyMark
          companyName="NAVER"
          sourceUrl="https://recruit.navercorp.com/jobs/1"
        />,
      );

      await waitFor(() => expect(container.querySelector("img")).toBeNull());
      expect(container).toHaveTextContent("NA");
    } finally {
      if (complete) {
        Object.defineProperty(HTMLImageElement.prototype, "complete", complete);
      }
      if (naturalWidth) {
        Object.defineProperty(
          HTMLImageElement.prototype,
          "naturalWidth",
          naturalWidth,
        );
      }
    }
  });
});
