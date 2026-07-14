import { describe, expect, it } from "vitest";

import { MOCK_SOCIAL_ITEMS } from "@/features/home-feed/mock-community";
import type { ResourceState } from "@/features/home-feed/resource-state";
import type {
  PostingListResponse,
  SkillStatsResponse,
} from "@/lib/types";

import {
  buildSearchScopeHref,
  buildSearchSnapshot,
  normalizeSearchQuery,
  normalizeSearchScope,
} from "./model";

const postings: ResourceState<PostingListResponse> = {
  status: "ready",
  data: {
    total: 4,
    items: [
      {
        id: "job-python-api",
        title: "Python API Engineer",
        company_name: "NAVER",
        company_slug: "naver",
        career_type: "experienced",
        employment_type: "FULL_TIME_WORKER",
        career_min: 3,
        career_max: 7,
        location: "서울",
        status: "open",
        source_url: "https://recruit.navercorp.com/job-python-api",
        last_verified_at: "2026-07-14T03:00:00.000Z",
        required_skills: ["Python", "Docker"],
        preferred_skills: ["Kubernetes"],
        unspecified_skills: [],
      },
      {
        id: "job-python-data",
        title: "Python Data Engineer",
        company_name: "네이버",
        company_slug: "naver",
        career_type: "experienced",
        employment_type: "FULL_TIME_WORKER",
        career_min: 2,
        career_max: null,
        location: "성남",
        status: "open",
        source_url: "https://recruit.navercorp.com/job-python-data",
        last_verified_at: "2026-07-13T03:00:00.000Z",
        required_skills: ["Python"],
        preferred_skills: ["Docker"],
        unspecified_skills: ["SQL"],
      },
      {
        id: "job-platform",
        title: "Platform Engineer",
        company_name: "S2W",
        company_slug: "s2w",
        career_type: "new_comer",
        employment_type: "FULL_TIME_WORKER",
        career_min: null,
        career_max: null,
        location: "성남",
        status: "open",
        source_url: "https://s2w.career.greetinghr.com/job-platform",
        last_verified_at: "2026-07-12T03:00:00.000Z",
        required_skills: ["Go"],
        preferred_skills: ["Docker"],
        unspecified_skills: ["Linux"],
      },
      {
        id: "job-unsafe-company",
        title: "Security Engineer",
        company_name: "잘못된 slug 기업",
        company_slug: "../unsafe",
        career_type: null,
        employment_type: null,
        career_min: null,
        career_max: null,
        location: null,
        status: "open",
        source_url: "https://careers.example.com/security",
        last_verified_at: "invalid-date",
        required_skills: [],
        preferred_skills: [],
        unspecified_skills: [],
      },
    ],
  },
};

const skillStats: ResourceState<SkillStatsResponse> = {
  status: "ready",
  data: {
    total: 4,
    items: [
      {
        skill: "CPython",
        category: "language",
        count: 2,
        required_count: 1,
        preferred_count: 1,
      },
      {
        skill: "Python",
        category: "language",
        count: 18,
        required_count: 12,
        preferred_count: 4,
        unspecified_count: 2,
      },
      {
        skill: "Python typing",
        category: "tool",
        count: 3,
      },
      {
        skill: "Go",
        category: "language",
        count: 9,
      },
    ],
  },
};

describe("global search model", () => {
  it("normalizes external query and scope values", () => {
    expect(normalizeSearchQuery(["  Python   backend  ", "ignored"])).toBe(
      "Python backend",
    );
    expect(normalizeSearchQuery("x".repeat(240))).toHaveLength(200);
    expect(normalizeSearchScope("companies")).toBe("companies");
    expect(normalizeSearchScope(["skills", "jobs"])).toBe("skills");
    expect(normalizeSearchScope("unknown")).toBe("all");
  });

  it("groups safe companies from actual posting responses without claiming a global count", () => {
    const snapshot = buildSearchSnapshot({
      query: "Python",
      scope: "all",
      postings,
      skillStats,
      communityItems: MOCK_SOCIAL_ITEMS,
    });

    expect(snapshot.companies).toHaveLength(2);
    expect(snapshot.companies[0]).toMatchObject({
      slug: "naver",
      name: "NAVER",
      href: "/companies/naver",
      postingCount: 2,
      latestVerifiedAt: "2026-07-14T03:00:00.000Z",
      skillNames: ["Python", "Docker", "Kubernetes", "SQL"],
    });
    expect(snapshot.companies.map((company) => company.slug)).not.toContain(
      "../unsafe",
    );
    expect(snapshot.jobs[0]).toMatchObject({
      id: "job-python-api",
      href: "/jobs/job-python-api",
      companyHref: "/companies/naver",
    });
    expect(snapshot.counts).toMatchObject({ companies: 2, jobs: 4 });
  });

  it("ranks exact, prefix, and partial skill matches from the actual stats sample", () => {
    const snapshot = buildSearchSnapshot({
      query: "Python",
      scope: "skills",
      postings,
      skillStats,
      communityItems: [],
    });

    expect(snapshot.skills.map((skill) => skill.name)).toEqual([
      "Python",
      "Python typing",
      "CPython",
    ]);
    expect(snapshot.skills[0]).toMatchObject({
      postingCount: 18,
      requiredCount: 12,
      preferredCount: 4,
      unspecifiedCount: 2,
      skillHref: "/skill-map?skill=Python",
      jobsHref: "/jobs?q=Python",
    });
  });

  it("searches mock community copy while keeping its example source explicit", () => {
    const snapshot = buildSearchSnapshot({
      query: "Kubernetes",
      scope: "community",
      postings,
      skillStats,
      communityItems: MOCK_SOCIAL_ITEMS,
    });

    expect(snapshot.community).toHaveLength(1);
    expect(snapshot.community[0]).toMatchObject({
      id: "kubernetes-experience",
      source: "mock",
      href: "/posts/kubernetes-experience",
    });
    expect(buildSearchScopeHref("연봉 협상", "community")).toBe(
      "/search?q=%EC%97%B0%EB%B4%89+%ED%98%91%EC%83%81&scope=community",
    );
  });

  it("distinguishes idle, ready, partial, and unavailable actual-data states", () => {
    expect(
      buildSearchSnapshot({
        query: "",
        scope: "all",
        postings: null,
        skillStats: null,
        communityItems: MOCK_SOCIAL_ITEMS,
      }).dataStatus,
    ).toBe("idle");

    const ready = buildSearchSnapshot({
      query: "not-found",
      scope: "all",
      postings: { status: "ready", data: { items: [], total: 0 } },
      skillStats: { status: "ready", data: { items: [], total: 0 } },
      communityItems: MOCK_SOCIAL_ITEMS,
    });
    expect(ready.dataStatus).toBe("ready");
    expect(ready.hasAnyResults).toBe(false);

    const partial = buildSearchSnapshot({
      query: "Python",
      scope: "all",
      postings: { status: "error", message: "공고 검색 실패" },
      skillStats,
      communityItems: [],
    });
    expect(partial.dataStatus).toBe("partial");
    expect(partial.errors).toEqual(["공고 검색 실패"]);
    expect(partial.counts.jobs).toBeNull();
    expect(partial.counts.skills).toBe(3);

    const unavailable = buildSearchSnapshot({
      query: "Python",
      scope: "all",
      postings: { status: "error", message: "공고 검색 실패" },
      skillStats: { status: "error", message: "기술 검색 실패" },
      communityItems: [],
    });
    expect(unavailable.dataStatus).toBe("error");
    expect(unavailable.errors).toEqual(["공고 검색 실패", "기술 검색 실패"]);
    expect(unavailable.hasAnyResults).toBe(false);
  });
});
