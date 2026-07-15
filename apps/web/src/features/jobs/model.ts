import { formatCareer } from "@/lib/labels";
import type { PostingSummary } from "@/lib/types";

export type JobView = "all" | "matched" | "saved";

export type JobEvidence = {
  matchedSkills: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  unspecifiedSkills: string[];
  extractedSkillCount: number;
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

export function filterJobPostings(
  postings: PostingSummary[],
  view: JobView,
  ownedSkills: string[],
  savedIds: string[],
) {
  if (view === "matched") {
    return postings.filter(
      (posting) => buildJobEvidence(posting, ownedSkills).matchedSkills.length > 0,
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
      ? `${label} ${minimum}년`
      : `${label} ${minimum}~${maximum}년`;
  }
  if (minimum !== null) return `${label} ${minimum}년 이상`;
  if (maximum !== null) return `${label} ${maximum}년 이하`;
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
  return date ? `${formatMonthDay(date)} 확인` : "확인일 미상";
}

export function formatClosingDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? `${formatMonthDay(date)} 마감` : null;
}

export function buildJobsSummary(postings: PostingSummary[]) {
  const companies = new Set(
    postings
      .map((posting) => posting.company_name.trim().toLocaleLowerCase("en-US"))
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
