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
      "내 기술과 경력을 바탕으로 이어갈 수 있는 커리어 방향과 관련 채용공고를 확인합니다.";

    expect(metadata.description).toBe(description);
    expect(metadata.openGraph?.description).toBe(description);
    expect(metadata.twitter?.description).toBe(description);
  });

  it("uses the exact concise manifest description", () => {
    expect(manifest().description).toBe(
      "내 경력과 기술이 어떤 커리어 방향 및 채용공고와 연결되는지 확인합니다.",
    );
  });
});
