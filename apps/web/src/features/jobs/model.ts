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

type JobRequirementInput = Pick<
  PostingSummary,
  "title" | "required_skills" | "preferred_skills" | "unspecified_skills"
>;

export type JobConnection = {
  label:
    | "현재 경력과 직접 연결"
    | "경험 활용도가 높은 인접 분야"
    | "기술 일부 연결"
    | "직무 경험 확인 필요"
    | "추가 확인이 필요한 공고"
    | "프로필과 비교 전";
  reason: string;
  matchedSkills: string[];
  unconfirmedRequiredSkills: string[];
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
  posting: JobRequirementInput,
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

function normalizedWords(value: string) {
  return value
    .toLocaleLowerCase("ko-KR")
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
}

function roleTitleConnected(role: string, title: string) {
  if (!role.trim()) return false;
  const titleWords = new Set(normalizedWords(title));
  return normalizedWords(role).some((word) => titleWords.has(word));
}

export function buildJobConnection(
  posting: JobRequirementInput,
  ownedSkills: string[],
  profile: CareerProfile,
): JobConnection {
  const evidence = buildJobEvidence(posting, ownedSkills);
  const owned = new Set(ownedSkills.map(skillKey).filter(Boolean));
  const unconfirmedRequiredSkills = evidence.requiredSkills.filter(
    (skill) => !owned.has(skillKey(skill)),
  );
  const roleConnected = roleTitleConnected(profile.currentRole, posting.title);
  const base = {
    matchedSkills: evidence.matchedSkills,
    unconfirmedRequiredSkills,
    extractedSkillCount: evidence.extractedSkillCount,
  };

  if (!profile.currentRole && ownedSkills.length === 0) {
    return {
      ...base,
      label: "프로필과 비교 전",
      reason: "내 커리어에 직무나 기술을 입력하면 공고와 연결되는 근거를 확인할 수 있습니다.",
    };
  }

  if (roleConnected && evidence.matchedSkills.length > 0) {
    return {
      ...base,
      label: "현재 경력과 직접 연결",
      reason: `현재 직무와 공고 제목이 연결되고, 확인된 기술 조건 ${evidence.extractedSkillCount}개 중 ${evidence.matchedSkills.length}개가 프로필과 겹칩니다.`,
    };
  }

  if (
    evidence.matchedSkills.length >= 2 &&
    evidence.matchedSkills.length / Math.max(1, evidence.extractedSkillCount) >= 0.4
  ) {
    return {
      ...base,
      label: "경험 활용도가 높은 인접 분야",
      reason: `확인된 기술 조건 ${evidence.extractedSkillCount}개 중 ${evidence.matchedSkills.length}개가 프로필과 겹칩니다: ${evidence.matchedSkills.join(", ")}.`,
    };
  }

  if (evidence.matchedSkills.length > 0) {
    const matchedLabel = evidence.matchedSkills.join(", ");
    return {
      ...base,
      label: "기술 일부 연결",
      reason:
        evidence.matchedSkills.length === 1
          ? `확인된 기술 조건 ${evidence.extractedSkillCount}개 중 ${matchedLabel} 1개가 프로필과 겹칩니다. 이 한 항목만으로 강한 연결을 뜻하지 않습니다.`
          : `확인된 기술 조건 ${evidence.extractedSkillCount}개 중 ${evidence.matchedSkills.length}개가 프로필과 겹치지만, 공고의 역할과 조건을 더 확인해야 합니다.`,
    };
  }

  if (roleConnected) {
    return {
      ...base,
      label: "직무 경험 확인 필요",
      reason: "현재 직무와 공고 제목에는 연결되는 표현이 있지만, 공개된 기술 조건에서 겹치는 항목은 확인되지 않았습니다.",
    };
  }

  return {
    ...base,
    label: "추가 확인이 필요한 공고",
    reason:
      evidence.extractedSkillCount > 0
        ? "현재 프로필에서 공고의 기술 조건과 겹치는 항목을 확인하지 못했습니다. 공고의 업무와 책임을 함께 확인해 주세요."
        : "채용공고 내용에서 비교할 기술 조건이 확인되지 않았습니다. 업무와 책임을 직접 확인해 주세요.",
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
    return postings.filter((posting) => {
      const connection = buildJobConnection(posting, ownedSkills, profile);
      return (
        connection.matchedSkills.length > 0 ||
        connection.label === "직무 경험 확인 필요"
      );
    });
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

export function formatDiscoveredDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? `${formatMonthDay(date)} 커리어핏 최초 확인` : null;
}

export function formatClosingDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? `${formatMonthDay(date)} 마감` : null;
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
