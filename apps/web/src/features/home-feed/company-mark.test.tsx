import { fireEvent, render } from "@testing-library/react";
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

    fireEvent.error(image!);

    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("NA");
  });
});
