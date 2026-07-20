import type { Metadata } from "next";

import { JobList } from "@/features/jobs/job-list";
import type { JobView } from "@/features/jobs/model";
import { getPostings } from "@/lib/api";
import { normalizePostingList } from "@/lib/posting-contract";
import { normalizeSkillCategory } from "@/lib/skill-categories";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공고 탐색",
  description: "한국 기술기업의 공식 채용페이지에서 확인한 개발 직군 공고를 검색합니다.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const SUPPORTED_CAREER_TYPES = new Set(["new_comer", "experienced", "mixed"]);
const SUPPORTED_VIEWS = new Set<JobView>(["all", "matched", "saved"]);
const JOBS_PER_PAGE = 20;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function positivePage(value: string | string[] | undefined) {
  const parsed = Number.parseInt(first(value), 10);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, 5_000)
    : 1;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
} = {}) {
  const params = searchParams ? await searchParams : {};
  const query = first(params.q).trim();
  const requestedCareerType = first(params.career_type);
  const careerType = SUPPORTED_CAREER_TYPES.has(requestedCareerType)
    ? requestedCareerType
    : "";
  const category = normalizeSkillCategory(params.category);
  const page = positivePage(params.page);
  const requestedView = first(params.view) as JobView;
  const initialView = SUPPORTED_VIEWS.has(requestedView)
    ? requestedView
    : "all";
  const saveSearchRequested = first(params.save_search) === "1";

  try {
    const postings = normalizePostingList(
      await getPostings({
        ...(query ? { q: query } : {}),
        ...(careerType ? { career_type: careerType } : {}),
        ...(category ? { category } : {}),
        limit: JOBS_PER_PAGE,
        offset: (page - 1) * JOBS_PER_PAGE,
      }),
    );
    return (
      <JobList
        filters={{ query, careerType, category }}
        currentPage={page}
        initialView={initialView}
        pageSize={JOBS_PER_PAGE}
        postings={postings}
        saveSearchRequested={saveSearchRequested}
      />
    );
  } catch (error) {
    console.error("[jobs] request failed", error);
    return (
      <JobList
        error
        filters={{ query, careerType, category }}
        currentPage={page}
        initialView={initialView}
        pageSize={JOBS_PER_PAGE}
        postings={null}
        saveSearchRequested={saveSearchRequested}
      />
    );
  }
}
