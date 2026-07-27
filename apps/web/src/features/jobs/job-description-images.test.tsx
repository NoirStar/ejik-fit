import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { JobDescriptionImages } from "./job-description-images";

const images = [
  {
    url: "https://ligdna.recruiter.co.kr/upload/full.png",
    alt: "채용 공고 상세 내용 이미지 1",
  },
];

describe("JobDescriptionImages", () => {
  afterEach(() => cleanup());

  it("loads source images lazily without sending the page referrer", () => {
    render(<JobDescriptionImages images={images} />);

    const image = screen.getByRole("img", {
      name: "채용 공고 상세 내용 이미지 1",
    });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveAttribute("fetchpriority", "low");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("hides only a failed image", () => {
    render(<JobDescriptionImages images={images} />);

    fireEvent.error(
      screen.getByRole("img", { name: "채용 공고 상세 내용 이미지 1" }),
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "기업이 제공한 공고 상세 이미지" }),
    ).not.toBeInTheDocument();
  });
});
