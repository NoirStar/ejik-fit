import { afterEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_DRAFT_STORAGE_KEY,
  readCommunityDraft,
  removeCommunityDraft,
  saveCommunityDraft,
} from "./community-draft";

describe("community draft", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("round-trips a normalized versioned draft", () => {
    const saved = saveCommunityDraft(
      {
        category: "커리어 질문",
        title: "  도움을 받고 싶어요  ",
        body: "  다음 학습 순서가 궁금합니다.  ",
        tags: [" React ", "TypeScript"],
      },
      sessionStorage,
      new Date("2026-07-23T01:00:00.000Z"),
    );

    expect(saved).toEqual({
      version: 1,
      category: "커리어 질문",
      title: "도움을 받고 싶어요",
      body: "다음 학습 순서가 궁금합니다.",
      tags: ["React", "TypeScript"],
      savedAt: "2026-07-23T01:00:00.000Z",
    });
    expect(
      readCommunityDraft(
        sessionStorage,
        new Date("2026-07-24T01:00:00.000Z"),
      ),
    ).toEqual(saved);
  });

  it("removes malformed or contract-invalid stored values", () => {
    sessionStorage.setItem(COMMUNITY_DRAFT_STORAGE_KEY, "{broken");
    expect(readCommunityDraft(sessionStorage)).toBeNull();
    expect(sessionStorage.getItem(COMMUNITY_DRAFT_STORAGE_KEY)).toBeNull();

    sessionStorage.setItem(
      COMMUNITY_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        category: "알 수 없는 종류",
        title: "제목",
        body: "본문",
        tags: [],
        savedAt: "2026-07-23T01:00:00.000Z",
      }),
    );
    expect(readCommunityDraft(sessionStorage)).toBeNull();
    expect(sessionStorage.getItem(COMMUNITY_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("expires a draft after seven days", () => {
    saveCommunityDraft(
      {
        category: "커리어 고민",
        title: "오래된 고민",
        body: "지금은 다시 확인해야 합니다.",
        tags: [],
      },
      sessionStorage,
      new Date("2026-07-01T00:00:00.000Z"),
    );

    expect(
      readCommunityDraft(
        sessionStorage,
        new Date("2026-07-08T00:00:00.001Z"),
      ),
    ).toBeNull();
    expect(sessionStorage.getItem(COMMUNITY_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("removes a draft only when explicitly requested", () => {
    saveCommunityDraft(
      {
        category: "면접 후기",
        title: "면접 회고",
        body: "다른 사람에게 도움이 될 내용입니다.",
        tags: ["면접"],
      },
      sessionStorage,
    );

    expect(readCommunityDraft(sessionStorage)).not.toBeNull();
    removeCommunityDraft(sessionStorage);
    expect(readCommunityDraft(sessionStorage)).toBeNull();
  });
});
