import { buildCareerAnalysis } from "@/features/career-analysis/model";
import { formatCareer } from "@/lib/labels";
import {
  EMPTY_CAREER_PROFILE,
  type CareerProfile,
} from "@/lib/career-profile";
import { stableCompanyIdentity } from "@/lib/company-identity";
import type { PostingSummary } from "@/lib/types";

export type JobView = "all" | "matched" | "saved";

export type JobEvidence = {
  matchedSkills: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  unspecifiedSkills: string[];
  extractedSkillCount: number;
};

export type JobConnection = {
  label: string;
  reason: string;
  matchedSkills: string[];
  unconfirmedRequiredSkills: string[];
  extractedSkillCount: number;
  directionId: string | null;
  directionLabel: string | null;
  recommendationEligible: boolean;
  evidenceTypes: string[];
};

function skillKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function uniqueSkills(values: string[] | undefined, excluded = new Set<string>()) {
  const seen = new Set(excluded);
  return (values ?? []).flatMap((value) => {
    const skill = value.trim();
    const key = skillKey(skill);
    if (!skill || seen.has(key)) return [];
    seen.add(key);
    return [skill];
  });
}

export function buildJobEvidence(
  posting: PostingSummary,
  ownedSkills: string[],
): JobEvidence {
  const requiredSkills = uniqueSkills(posting.required_skills);
  const requiredKeys = new Set(requiredSkills.map(skillKey));
  const preferredSkills = uniqueSkills(posting.preferred_skills, requiredKeys);
  const declaredKeys = new Set([
    ...requiredKeys,
    ...preferredSkills.map(skillKey),
  ]);
  const unspecifiedSkills = uniqueSkills(
    posting.unspecified_skills,
    declaredKeys,
  );
  const allSkills = [
    ...requiredSkills,
    ...preferredSkills,
    ...unspecifiedSkills,
  ];
  const owned = new Set(ownedSkills.map(skillKey).filter(Boolean));

  return {
    matchedSkills: allSkills.filter((skill) => owned.has(skillKey(skill))),
    requiredSkills,
    preferredSkills,
    unspecifiedSkills,
    extractedSkillCount: allSkills.length,
  };
}

export function buildJobConnection(
  posting: PostingSummary,
  ownedSkills: string[],
  profile: CareerProfile,
): JobConnection {
  const evidence = buildJobEvidence(posting, ownedSkills);
  const connection = buildCareerAnalysis({
    profile,
    ownedSkills,
    postings: [posting],
  }).jobConnections[posting.id];
  return {
    label: connection.label,
    reason: connection.reasons[0] ?? "공고의 역할과 업무를 직접 확인해 주세요.",
    matchedSkills: connection.matchedSkills,
    unconfirmedRequiredSkills: connection.unconfirmedRequiredSkills,
    extractedSkillCount: evidence.extractedSkillCount,
    directionId: connection.directionId,
    directionLabel: connection.directionLabel,
    recommendationEligible: connection.recommendationEligible,
    evidenceTypes: connection.evidenceTypes,
  };
}

export function filterJobPostings(
  postings: PostingSummary[],
  view: JobView,
  ownedSkills: string[],
  savedIds: string[],
  profile: CareerProfile = EMPTY_CAREER_PROFILE,
) {
  if (view === "matched") {
    const analysis = buildCareerAnalysis({ profile, ownedSkills, postings });
    return postings.filter(
      (posting) => analysis.jobConnections[posting.id].recommendationEligible,
    );
  }
  if (view === "saved") {
    const saved = new Set(savedIds);
    return postings.filter((posting) => saved.has(posting.id));
  }
  return postings;
}

export function formatCareerRange(posting: PostingSummary) {
  const label = formatCareer(posting.career_type);
  if (posting.career_type === "new_comer" || posting.career_type === "newcomer") {
    return label;
  }
  const minimum = posting.career_min;
  const maximum = posting.career_max;
  if (minimum !== null && maximum !== null) {
    return minimum === maximum
      ? label + " " + minimum + "년"
      : label + " " + minimum + "~" + maximum + "년";
  }
  if (minimum !== null) return label + " " + minimum + "년 이상";
  if (maximum !== null) return label + " " + maximum + "년 이하";
  return label;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function formatVerifiedDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? formatMonthDay(date) + " 확인" : "확인일 미상";
}

export function formatDiscoveredDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? formatMonthDay(date) + " 처음 확인" : null;
}

export function formatClosingDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? formatMonthDay(date) + " 마감" : null;
}

export function buildJobsSummary(postings: PostingSummary[]) {
  const companies = new Set(
    postings
      .map((posting) => stableCompanyIdentity(posting))
      .filter(Boolean),
  );
  const latest = postings.reduce<Date | null>((current, posting) => {
    const candidate = parseDate(posting.last_verified_at);
    if (!candidate || (current && candidate <= current)) return current;
    return candidate;
  }, null);

  return {
    postingCount: postings.length,
    companyCount: companies.size,
    latestVerifiedLabel: latest ? formatMonthDay(latest) : "확인일 미상",
  };
}
