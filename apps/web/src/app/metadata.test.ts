import { describe, expect, it, vi } from "vitest";

import { metadata } from "./layout";
import manifest from "./manifest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist" }),
}));

vi.mock("@/components/app-shell/app-shell", () => ({
  AppShell: vi.fn(),
}));

describe("global product metadata", () => {
  it("uses the exact product description across shared metadata", () => {
    const description =
      "채용공고의 기술 수요와 내 기술을 비교하는 이직핏입니다.";

    expect(metadata.description).toBe(description);
    expect(metadata.openGraph?.description).toBe(description);
    expect(metadata.twitter?.description).toBe(description);
  });

  it("uses the exact concise manifest description", () => {
    expect(manifest().description).toBe("채용공고 기술 분석과 스킬맵");
  });
});
