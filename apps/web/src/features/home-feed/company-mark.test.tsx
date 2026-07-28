import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CompanyMark, hasEnoughLogoPixels } from "./company-mark";

describe("CompanyMark", () => {
  afterEach(() => cleanup());

  it("rejects tiny favicons but keeps sufficiently detailed wide logos", () => {
    expect(
      hasEnoughLogoPixels({
        naturalWidth: 16,
        naturalHeight: 16,
        boxSize: 56,
        devicePixelRatio: 2,
      }),
    ).toBe(false);
    expect(
      hasEnoughLogoPixels({
        naturalWidth: 117,
        naturalHeight: 27,
        boxSize: 56,
        devicePixelRatio: 2,
      }),
    ).toBe(true);
    expect(
      hasEnoughLogoPixels({
        naturalWidth: 151,
        naturalHeight: 45,
        boxSize: 56 * 0.76,
        devicePixelRatio: 2,
      }),
    ).toBe(true);
  });

  it("keeps the official NAVER WEBTOON wordmark after it loads", () => {
    const { container } = render(
      <CompanyMark
        companyName="네이버웹툰"
        size={56}
        sourceUrl="https://recruit.webtoonscorp.com/rcrt/view.do?annoId=1"
      />,
    );
    const image = container.querySelector("img");
    expect(image).toHaveAttribute(
      "src",
      "/company-logo-assets/naver-webtoon",
    );
    Object.defineProperties(image!, {
      naturalHeight: { configurable: true, value: 45 },
      naturalWidth: { configurable: true, value: 151 },
    });

    fireEvent.load(image!);

    expect(container.querySelector("img")).toBe(image);
  });

  it("falls back to initials after a low-resolution logo loads", () => {
    const { container } = render(
      <CompanyMark
        companyName="NAVER"
        size={56}
        sourceUrl="https://recruit.navercorp.com/jobs/1"
      />,
    );
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    Object.defineProperties(image!, {
      naturalHeight: { configurable: true, value: 16 },
      naturalWidth: { configurable: true, value: 16 },
    });

    fireEvent.load(image!);

    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("NA");
  });

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
