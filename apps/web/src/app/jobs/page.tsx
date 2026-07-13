import type { Metadata } from "next";

import { JobList } from "@/features/jobs/job-list";
import { getPostings } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공고 탐색",
  description: "한국 기술기업의 공식 채용페이지에서 확인한 개발 직군 공고를 검색합니다.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const SUPPORTED_CAREER_TYPES = new Set(["new_comer", "experienced", "mixed"]);

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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

  try {
    const postings = await getPostings({
      ...(query ? { q: query } : {}),
      ...(careerType ? { career_type: careerType } : {}),
      limit: 100,
    });
    return (
      <JobList
        filters={{ query, careerType }}
        postings={postings}
      />
    );
  } catch (error) {
    return (
      <JobList
        error={error instanceof Error ? error.message : "잠시 뒤 다시 시도해 주세요."}
        filters={{ query, careerType }}
        postings={null}
      />
    );
  }
}
