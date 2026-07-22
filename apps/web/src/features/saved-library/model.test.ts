import { describe, expect, it } from "vitest";

import { MOCK_SOCIAL_ITEMS } from "@/features/home-feed/mock-community";
import { localCommunityPostToFeedItem } from "@/features/home-feed/model";
import type { PostingDetail } from "@/lib/types";

import {
  buildSavedJobItem,
  normalizeSavedJobDataResponse,
  normalizeSavedJobRequest,
  selectSavedCommunityItems,
} from "./model";

const posting: PostingDetail = {
  id: "job-python",
  title: "Python Backend Engineer",
  company_name: "NAVER",
  company_slug: "naver",
  career_type: "experienced",
  employment_type: "FULL_TIME_WORKER",
  career_min: 3,
  career_max: 7,
  location: "서울",
  status: "open",
  source_url: "https://recruit.navercorp.com/job-python",
  last_verified_at: "2026-07-14T03:00:00.000Z",
  opens_at: null,
  closes_at: "2026-07-31T03:00:00.000Z",
  required_skills: ["Python", "Docker"],
  preferred_skills: ["Kubernetes", "Python"],
  unspecified_skills: ["Linux", "Docker"],
  description_html: "<p>보관함 응답에 포함하면 안 됩니다.</p>",
  description_text: "보관함 응답에 포함하면 안 됩니다.",
  skills: ["Python", "Docker", "Kubernetes", "Linux"],
};

describe("saved library model", () => {
  it("builds a compact saved job from actual normalized posting evidence", () => {
    expect(buildSavedJobItem(posting)).toEqual({
      id: "job-python",
      title: "Python Backend Engineer",
      companyName: "NAVER",
      companyHref: "/companies/naver",
      detailHref: "/jobs/job-python",
      sourceUrl: "https://recruit.navercorp.com/job-python",
      careerLabel: "경력 3~7년",
      employmentLabel: "정규직",
      location: "서울",
      status: "open",
      statusLabel: "공개 중",
      verifiedLabel: "7월 14일 확인",
      closingLabel: "7월 31일 마감",
      requiredSkills: ["Python", "Docker"],
      preferredSkills: ["Kubernetes"],
      unspecifiedSkills: ["Linux"],
    });
    expect(buildSavedJobItem(posting)).not.toHaveProperty("description_html");
    expect(buildSavedJobItem(posting)).not.toHaveProperty("description_text");
  });

  it("normalizes unique lookup IDs and rejects malformed or oversized requests", () => {
    expect(
      normalizeSavedJobRequest({
        job_ids: [" job-python ", "job-go", "job-python"],
      }),
    ).toEqual(["job-python", "job-go"]);

    for (const value of [
      null,
      {},
      { job_ids: "job-python" },
      { job_ids: [""] },
      { job_ids: [42] },
      { job_ids: ["x".repeat(201)] },
      { job_ids: Array.from({ length: 25 }, (_, index) => `job-${index}`) },
    ]) {
      expect(() => normalizeSavedJobRequest(value)).toThrow(TypeError);
    }
  });

  it("validates the client route response and rejects unsafe external URLs", () => {
    const item = buildSavedJobItem(posting);
    expect(
      normalizeSavedJobDataResponse({
        items: [item],
        unavailable_ids: ["gone-job", "gone-job"],
        failed_ids: ["retry-job"],
      }),
    ).toEqual({
      items: [item],
      unavailableIds: ["gone-job"],
      failedIds: ["retry-job"],
    });

    expect(() =>
      normalizeSavedJobDataResponse({
        items: [{ ...item, sourceUrl: "javascript:alert(1)" }],
        unavailable_ids: [],
        failed_ids: [],
      }),
    ).toThrow(TypeError);
  });

  it("selects durable local records but ignores read-only starter saves", () => {
    const localPost = localCommunityPostToFeedItem(
      {
        id: "local-browser-question",
        title: "브라우저에 저장한 내 질문",
        body: "공식 공고를 비교한 뒤 남긴 질문입니다.",
        tags: ["백엔드", "이직 준비"],
        createdAt: "2026-07-14T03:00:00.000Z",
      },
      new Date("2026-07-14T03:05:00.000Z"),
    );
    const selected = selectSavedCommunityItems(
      [
        "local-browser-question",
        "kubernetes-experience",
        "local-missing",
        "career-move-3y-backend",
      ],
      [...MOCK_SOCIAL_ITEMS, localPost],
    );

    expect(selected.items.map((item) => item.id)).toEqual([
      "local-browser-question",
    ]);
    expect(selected.items[0]).toMatchObject({
      source: "local",
      title: "브라우저에 저장한 내 질문",
      authorName: "나",
      createdLabel: "5분 전",
    });
    expect(selected.unavailableIds).toEqual(["local-missing"]);
  });
});
