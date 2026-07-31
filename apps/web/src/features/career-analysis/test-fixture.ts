import type { CareerAnalyzeResponse, PostingSummary } from "@/lib/types";

export function careerAnalysisFixture(
  postings: PostingSummary[],
  options: { eligibleIds?: string[]; domain?: string; label?: string } = {},
): CareerAnalyzeResponse {
  const domain = options.domain ?? "backend";
  const label = options.label ?? "백엔드";
  const eligible = new Set(options.eligibleIds ?? postings.map((item) => item.id));
  const connection = (posting: PostingSummary) => ({
    direction_id: eligible.has(posting.id) ? domain : null,
    direction_label: eligible.has(posting.id) ? label : null,
    direction_kind: eligible.has(posting.id) ? "direct" as const : null,
    connection_level: eligible.has(posting.id) ? "direct" as const : "limited" as const,
    label: eligible.has(posting.id) ? "현재 경력과 직접 이어짐" : "추가 확인이 필요한 공고",
    recommendation_eligible: eligible.has(posting.id),
    reasons: [eligible.has(posting.id)
      ? "현재 직무와 공고의 주요 업무가 겹칩니다."
      : "공고 역할과 이어지는 근거를 확인하지 못했습니다."],
    evidence_types: eligible.has(posting.id) ? ["role", "responsibility"] : [],
    matched_skills: eligible.has(posting.id) ? (posting.required_skills ?? []).slice(0, 1) : [],
    matched_responsibilities: eligible.has(posting.id) ? ["api"] : [],
    unconfirmed_conditions: [],
    career_condition: "continues" as const,
    employment_condition: "continues" as const,
    location_condition: "continues" as const,
  });
  const eligiblePostings = postings.filter((item) => eligible.has(item.id));
  return {
    version: "career-evidence-v3.0",
    snapshot_id: "career-test-snapshot",
    calculated_at: postings[0]?.last_verified_at ?? null,
    analyzed_posting_count: postings.length,
    analyzed_company_count: new Set(postings.map((item) => item.company_slug ?? item.company_name)).size,
    directions: eligiblePostings.length ? [{
      domain,
      label,
      kind: "direct",
      reasons: ["현재 직무와 이 분야의 역할이 겹칩니다."],
      evidence_types: ["role", "responsibility"],
      matched_skills: eligiblePostings[0]?.required_skills?.slice(0, 1) ?? [],
      posting_count: eligiblePostings.length,
      company_count: new Set(eligiblePostings.map((item) => item.company_slug ?? item.company_name)).size,
      additional_conditions: [],
      career_counts: { new_comer: 0, experienced: eligiblePostings.length, mixed_or_unknown: 0 },
      representative_tasks: ["API 개발"],
      representative_job: eligiblePostings[0] ? {
        id: eligiblePostings[0].id,
        title: eligiblePostings[0].title,
        company_name: eligiblePostings[0].company_name,
      } : null,
    }] : [],
    recommendations: {
      items: eligiblePostings.map((posting) => ({ posting, connection: connection(posting) })),
      total: eligiblePostings.length,
      limit: 12,
      offset: 0,
    },
    connections: Object.fromEntries(postings.map((posting) => [posting.id, connection(posting)])),
    profile_evidence_used: ["current_role", "responsibilities"],
    profile_information_not_confirmed: [],
  };
}
