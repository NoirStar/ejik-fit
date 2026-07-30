import { formatDomainLabel } from "@/features/career/model";
import {
  EMPTY_CAREER_PROFILE,
  normalizeCareerProfile,
  type CareerProfile,
  type CareerWorkType,
} from "@/lib/career-profile";
import { stableCompanyIdentity } from "@/lib/company-identity";
import { skillIdentityKey } from "@/lib/skill-catalog";
import type { PostingSummary } from "@/lib/types";

export const CAREER_ANALYSIS_VERSION = "career-evidence-v2.0";

export type CareerDirectionKind =
  | "direct"
  | "adjacent"
  | "interest"
  | "transition";

export type CareerEvidenceType =
  | "role"
  | "responsibility"
  | "achievement"
  | "industry"
  | "workType"
  | "skill"
  | "career"
  | "location"
  | "employment"
  | "interest";

export type CareerConnectionLevel =
  | "direct"
  | "adjacent"
  | "interest"
  | "limited"
  | "unconfigured";

type DomainDefinition = {
  id: string;
  label: string;
  titleTerms: readonly string[];
  responsibilityTerms: readonly string[];
  strongSkills: readonly string[];
  supportingSkills: readonly string[];
  workTypes: readonly CareerWorkType[];
};

const DOMAIN_DEFINITIONS: readonly DomainDefinition[] = [
  {
    id: "backend",
    label: "백엔드",
    titleTerms: ["backend", "back-end", "백엔드", "서버 개발", "server engineer"],
    responsibilityTerms: ["api 개발", "서버 개발", "서비스 개발", "트래픽", "분산 시스템", "결제 api"],
    strongSkills: ["spring", "spring boot", "django", "fastapi", "nestjs", "kafka", "redis"],
    supportingSkills: ["java", "kotlin", "go", "python", "node.js", "postgresql", "mysql"],
    workTypes: ["development", "operations", "automation"],
  },
  {
    id: "frontend",
    label: "프론트엔드",
    titleTerms: ["frontend", "front-end", "프론트엔드", "web frontend"],
    responsibilityTerms: ["웹 화면", "사용자 인터페이스", "웹 프론트", "디자인 시스템", "브라우저"],
    strongSkills: ["react", "vue", "angular", "next.js", "svelte"],
    supportingSkills: ["typescript", "javascript", "html", "css"],
    workTypes: ["development"],
  },
  {
    id: "mobile",
    label: "모바일",
    titleTerms: ["mobile", "모바일", "android", "ios", "앱 개발"],
    responsibilityTerms: ["모바일 앱", "안드로이드", "아이폰 앱", "앱 서비스"],
    strongSkills: ["swift", "swiftui", "kotlin", "flutter", "react native"],
    supportingSkills: ["java", "typescript", "dart"],
    workTypes: ["development"],
  },
  {
    id: "data",
    label: "데이터",
    titleTerms: ["data engineer", "data analyst", "analytics engineer", "데이터 엔지니어", "데이터 분석"],
    responsibilityTerms: ["데이터 파이프라인", "데이터 웨어하우스", "etl", "지표 분석", "데이터 모델링"],
    strongSkills: ["airflow", "spark", "flink", "bigquery", "snowflake", "dbt"],
    supportingSkills: ["sql", "python", "kafka", "pandas"],
    workTypes: ["development", "analysis", "automation"],
  },
  {
    id: "ai",
    label: "AI",
    titleTerms: ["ai engineer", "machine learning", "ml engineer", "인공지능", "머신러닝", "llm engineer"],
    responsibilityTerms: ["모델 학습", "모델 추론", "llm", "rag", "생성형 ai", "머신러닝 모델"],
    strongSkills: ["pytorch", "tensorflow", "hugging face", "vllm", "langchain"],
    supportingSkills: ["python", "numpy", "pandas", "cuda"],
    workTypes: ["development", "analysis"],
  },
  {
    id: "mlops",
    label: "MLOps",
    titleTerms: ["mlops", "machine learning platform", "ai platform", "머신러닝 플랫폼"],
    responsibilityTerms: ["모델 배포", "학습 파이프라인", "모델 서빙", "모델 모니터링", "ai 인프라"],
    strongSkills: ["mlflow", "kubeflow", "vllm", "ray"],
    supportingSkills: ["python", "kubernetes", "docker", "airflow", "prometheus"],
    workTypes: ["development", "operations", "automation", "analysis"],
  },
  {
    id: "devops",
    label: "DevOps·플랫폼",
    titleTerms: ["devops", "sre", "platform engineer", "플랫폼 엔지니어", "site reliability"],
    responsibilityTerms: ["배포 자동화", "ci/cd", "장애 대응", "플랫폼 운영", "서비스 운영", "관측성", "인프라 자동화"],
    strongSkills: ["kubernetes", "terraform", "ansible", "helm", "prometheus", "grafana"],
    supportingSkills: ["docker", "linux", "aws", "gcp", "azure", "python", "go"],
    workTypes: ["operations", "automation", "development"],
  },
  {
    id: "cloud",
    label: "클라우드",
    titleTerms: ["cloud engineer", "cloud architect", "클라우드 엔지니어", "클라우드 아키텍트"],
    responsibilityTerms: ["클라우드 인프라", "클라우드 전환", "클라우드 아키텍처", "멀티 클라우드"],
    strongSkills: ["aws", "gcp", "azure", "terraform", "cloudformation"],
    supportingSkills: ["kubernetes", "docker", "linux", "python", "go"],
    workTypes: ["operations", "automation", "development", "planning"],
  },
  {
    id: "security",
    label: "보안",
    titleTerms: ["security engineer", "security analyst", "보안 엔지니어", "보안 분석", "information security"],
    responsibilityTerms: ["침해 탐지", "보안 사고", "취약점", "보안 정책", "위협 분석", "보안 관제", "보안 자동화"],
    strongSkills: ["siem", "splunk", "wazuh", "burp suite", "nmap"],
    supportingSkills: ["linux", "python", "aws", "kubernetes", "network"],
    workTypes: ["operations", "analysis", "automation", "development"],
  },
  {
    id: "embedded",
    label: "임베디드",
    titleTerms: ["embedded", "firmware", "임베디드", "펌웨어"],
    responsibilityTerms: ["펌웨어 개발", "디바이스 드라이버", "실시간 운영체제", "하드웨어 제어"],
    strongSkills: ["rtos", "embedded linux", "autosar", "can"],
    supportingSkills: ["c", "c++", "linux", "cmake"],
    workTypes: ["development", "operations"],
  },
  {
    id: "automotive",
    label: "자동차 소프트웨어",
    titleTerms: ["automotive", "vehicle software", "자동차 소프트웨어", "차량 소프트웨어"],
    responsibilityTerms: ["차량 제어", "차량용", "전장", "adas", "인포테인먼트"],
    strongSkills: ["autosar", "can", "matlab", "simulink"],
    supportingSkills: ["c", "c++", "python", "linux"],
    workTypes: ["development", "analysis"],
  },
  {
    id: "robotics",
    label: "로보틱스",
    titleTerms: ["robotics", "robot engineer", "로봇", "로보틱스"],
    responsibilityTerms: ["로봇 제어", "모션 플래닝", "slam", "센서 융합", "로봇 플랫폼"],
    strongSkills: ["ros", "ros2", "moveit", "gazebo"],
    supportingSkills: ["c++", "python", "linux", "opencv"],
    workTypes: ["development", "analysis", "operations"],
  },
  {
    id: "qa",
    label: "QA·테스트 자동화",
    titleTerms: ["qa engineer", "test engineer", "sdet", "품질 엔지니어", "테스트 엔지니어"],
    responsibilityTerms: ["테스트 자동화", "품질 보증", "테스트 시나리오", "회귀 테스트"],
    strongSkills: ["selenium", "playwright", "cypress", "appium"],
    supportingSkills: ["python", "javascript", "typescript", "pytest"],
    workTypes: ["development", "automation", "analysis"],
  },
  {
    id: "product",
    label: "프로덕트",
    titleTerms: ["product manager", "product owner", "프로덕트 매니저", "서비스 기획", "pm"],
    responsibilityTerms: ["제품 전략", "서비스 기획", "요구사항 정의", "제품 지표", "로드맵"],
    strongSkills: ["figma", "amplitude", "mixpanel"],
    supportingSkills: ["sql", "jira"],
    workTypes: ["planning", "analysis", "leadership"],
  },
  {
    id: "game",
    label: "게임 개발",
    titleTerms: ["game developer", "game programmer", "게임 개발", "게임 프로그래머"],
    responsibilityTerms: ["게임 클라이언트", "게임 서버", "게임플레이", "게임 엔진"],
    strongSkills: ["unity", "unreal engine", "godot"],
    supportingSkills: ["c#", "c++", "python"],
    workTypes: ["development"],
  },
];

const DEFINITION_BY_ID = new Map(
  DOMAIN_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const KIND_RANK: Record<CareerDirectionKind, number> = {
  direct: 0,
  adjacent: 1,
  interest: 2,
  transition: 3,
};

const LEVEL_RANK: Record<CareerConnectionLevel, number> = {
  direct: 0,
  adjacent: 1,
  interest: 2,
  limited: 3,
  unconfigured: 4,
};

const GENERIC_WORDS = new Set([
  "개발",
  "경험",
  "업무",
  "담당",
  "운영",
  "관리",
  "서비스",
  "시스템",
  "engineer",
  "developer",
  "development",
]);

function normalizedText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").trim().toLocaleLowerCase("ko-KR");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function matchingTerms(text: string, terms: readonly string[]) {
  return terms.filter((term) => text.includes(term.toLocaleLowerCase("ko-KR")));
}

function normalizedSkills(posting: PostingSummary) {
  return unique([
    ...(posting.required_skills ?? []),
    ...(posting.preferred_skills ?? []),
    ...(posting.unspecified_skills ?? []),
  ]);
}

function skillMatches(
  skills: readonly string[],
  candidates: readonly string[],
) {
  const candidateKeys = new Set(candidates.map(skillIdentityKey));
  return skills.filter((skill) => candidateKeys.has(skillIdentityKey(skill)));
}

function meaningfulWords(value: string) {
  return unique(
    value
      .toLocaleLowerCase("ko-KR")
      .split(/[^\p{L}\p{N}+#.]+/u)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2 && !GENERIC_WORDS.has(word)),
  );
}

function commonResponsibilityWords(profileText: string, postingText: string) {
  const postingWords = new Set(meaningfulWords(postingText));
  return meaningfulWords(profileText)
    .filter((word) => postingWords.has(word))
    .slice(0, 4);
}

export type PostingDomainEvidence = {
  domain: string;
  label: string;
  explicitRole: boolean;
  titleTerms: string[];
  responsibilityTerms: string[];
  strongSkills: string[];
  supportingSkills: string[];
  inferredWorkTypes: CareerWorkType[];
};

export function classifyPostingDomains(
  posting: PostingSummary,
): PostingDomainEvidence[] {
  const title = normalizedText(posting.title);
  const body = normalizedText(posting.description_excerpt);
  const allText = normalizedText(posting.title, posting.description_excerpt);
  const skills = normalizedSkills(posting);

  return DOMAIN_DEFINITIONS.flatMap((definition) => {
    const titleTerms = matchingTerms(title, definition.titleTerms);
    const responsibilityTerms = matchingTerms(
      body,
      definition.responsibilityTerms,
    );
    const strongSkills = skillMatches(skills, definition.strongSkills);
    const supportingSkills = skillMatches(skills, definition.supportingSkills);
    const hasExplicitText = titleTerms.length > 0 || responsibilityTerms.length > 0;
    const hasSpecificSkillCombination =
      strongSkills.length >= 2 ||
      (strongSkills.length >= 1 && supportingSkills.length >= 1);
    if (!hasExplicitText && !hasSpecificSkillCombination) return [];

    const inferredWorkTypes = definition.workTypes.filter((workType) => {
      const terms: Record<CareerWorkType, string[]> = {
        development: ["개발", "build", "implement", "설계"],
        operations: ["운영", "장애", "monitor", "on-call", "maintenance"],
        analysis: ["분석", "analysis", "research", "모델링"],
        automation: ["자동화", "automation", "pipeline", "ci/cd"],
        planning: ["기획", "strategy", "roadmap", "요구사항"],
        leadership: ["리드", "lead", "매니징", "mentoring"],
      };
      return terms[workType].some((term) => allText.includes(term));
    });

    return [{
      domain: definition.id,
      label: definition.label,
      explicitRole: hasExplicitText,
      titleTerms,
      responsibilityTerms,
      strongSkills,
      supportingSkills,
      inferredWorkTypes,
    }];
  }).sort((left, right) => {
    const leftStrength =
      left.titleTerms.length * 8 +
      left.responsibilityTerms.length * 5 +
      left.strongSkills.length * 3 +
      left.supportingSkills.length;
    const rightStrength =
      right.titleTerms.length * 8 +
      right.responsibilityTerms.length * 5 +
      right.strongSkills.length * 3 +
      right.supportingSkills.length;
    return rightStrength - leftStrength || left.label.localeCompare(right.label, "ko-KR");
  });
}

type ProfileDomainEvidence = {
  domain: string;
  kind: CareerDirectionKind;
  evidenceTypes: CareerEvidenceType[];
  reasons: string[];
  matchedRoleTerms: string[];
  matchedResponsibilityTerms: string[];
  matchedAchievementTerms: string[];
};

function profileDomainEvidence(
  profile: CareerProfile,
  ownedSkills: string[],
  definition: DomainDefinition,
): ProfileDomainEvidence {
  const currentRole = normalizedText(profile.currentRole);
  const pastRoles = normalizedText(...profile.pastRoles);
  const responsibilityText = normalizedText(
    profile.responsibilities,
    profile.keepExperience,
  );
  const achievementText = normalizedText(
    ...profile.experienceHighlights.flatMap((highlight) => [
      highlight.title,
      highlight.responsibilities,
      highlight.outcome,
    ]),
  );
  const currentRoleTerms = matchingTerms(currentRole, definition.titleTerms);
  const pastRoleTerms = matchingTerms(pastRoles, definition.titleTerms);
  const responsibilityTerms = matchingTerms(
    responsibilityText,
    definition.responsibilityTerms,
  );
  const achievementTerms = matchingTerms(
    achievementText,
    definition.responsibilityTerms,
  );
  const highlightedDomain = profile.experienceHighlights.some(
    (highlight) => highlight.domain === definition.id,
  );
  const highlightedSkills = profile.experienceHighlights.flatMap(
    (highlight) => highlight.skills,
  );
  const strongSkills = skillMatches(
    unique([...ownedSkills, ...highlightedSkills]),
    definition.strongSkills,
  );
  const supportingSkills = skillMatches(
    unique([...ownedSkills, ...highlightedSkills]),
    definition.supportingSkills,
  );
  const skillEvidence = unique([...strongSkills, ...supportingSkills]);
  const direct =
    profile.currentDomain === definition.id ||
    currentRoleTerms.length > 0 ||
    responsibilityTerms.length > 0;
  const adjacent =
    pastRoleTerms.length > 0 ||
    achievementTerms.length > 0 ||
    highlightedDomain ||
    strongSkills.length >= 2 ||
    (strongSkills.length >= 1 && supportingSkills.length >= 1);
  const interested = profile.interestDomains.includes(definition.id);
  const kind: CareerDirectionKind = direct
    ? "direct"
    : adjacent
      ? "adjacent"
      : interested
        ? "interest"
        : "transition";
  const evidenceTypes: CareerEvidenceType[] = [];
  const reasons: string[] = [];

  if (profile.currentDomain === definition.id || currentRoleTerms.length > 0) {
    evidenceTypes.push("role");
    reasons.push(
      profile.currentRole
        ? `${profile.currentRole} 직무 경험이 ${definition.label} 공고의 역할과 이어집니다.`
        : `현재 분야가 ${definition.label}으로 설정되어 있습니다.`,
    );
  }
  if (pastRoleTerms.length > 0) {
    evidenceTypes.push("role");
    reasons.push(`과거 직무 경험이 ${definition.label} 공고의 역할과 겹칩니다.`);
  }
  if (responsibilityTerms.length > 0) {
    evidenceTypes.push("responsibility");
    reasons.push(
      `${responsibilityTerms.slice(0, 2).join(", ")} 업무가 이 분야 공고에서 확인됩니다.`,
    );
  }
  if (achievementTerms.length > 0 || highlightedDomain) {
    evidenceTypes.push("achievement");
    reasons.push(`입력한 프로젝트·성과 경험이 ${definition.label} 업무와 연결됩니다.`);
  }
  if (skillEvidence.length > 0) {
    evidenceTypes.push("skill");
    const recentlyUsed = skillEvidence.filter(
      (skill) => profile.skillUsage[skill]?.lastUsed === "current",
    );
    const longestUsed = skillEvidence
      .map((skill) => ({ skill, years: profile.skillUsage[skill]?.years }))
      .filter(
        (item): item is { skill: string; years: number } =>
          item.years !== null && item.years !== undefined,
      )
      .sort((left, right) => right.years - left.years)[0];
    reasons.push(
      recentlyUsed.length > 0
        ? `${recentlyUsed.slice(0, 3).join(", ")}은 현재 사용 중인 기술로 입력되어 있습니다.`
        : longestUsed
          ? `${longestUsed.skill} 사용 기간 ${longestUsed.years}년을 관련 공고와 비교했습니다.`
          : `${skillEvidence.slice(0, 4).join(", ")} 사용 경험을 관련 공고와 비교했습니다.`,
    );
  }
  if (interested && !direct) {
    evidenceTypes.push("interest");
    reasons.push(`관심 분야로 선택한 ${definition.label} 공고를 탐색 범위에 포함했습니다.`);
  }

  return {
    domain: definition.id,
    kind,
    evidenceTypes: unique(evidenceTypes) as CareerEvidenceType[],
    reasons: unique(reasons),
    matchedRoleTerms: unique([...currentRoleTerms, ...pastRoleTerms]),
    matchedResponsibilityTerms: responsibilityTerms,
    matchedAchievementTerms: achievementTerms,
  };
}

export type CareerJobConnection = {
  postingId: string;
  directionId: string | null;
  directionLabel: string | null;
  directionKind: CareerDirectionKind | null;
  connectionLevel: CareerConnectionLevel;
  label: string;
  recommendationEligible: boolean;
  reasons: string[];
  evidenceTypes: CareerEvidenceType[];
  matchedSkills: string[];
  matchedResponsibilities: string[];
  matchedIndustries: string[];
  matchedWorkTypes: CareerWorkType[];
  unconfirmedRequiredSkills: string[];
  unconfirmedConditions: string[];
  careerCondition: "continues" | "check" | "changes";
};

function careerConditionFor(posting: PostingSummary, profile: CareerProfile) {
  const postingCareer = posting.career_type ?? "";
  const profileIsNewComer = profile.careerLevel === "new_comer";
  if (
    profile.careerLevel &&
    ((profileIsNewComer && postingCareer === "experienced") ||
      (!profileIsNewComer && ["new_comer", "newcomer"].includes(postingCareer)))
  ) {
    return "changes" as const;
  }
  if (profile.experienceYears === null) {
    return ["mixed", "not_matter"].includes(postingCareer) ||
      Boolean(profile.careerLevel && postingCareer)
      ? "continues" as const
      : "check" as const;
  }
  if (
    ["new_comer", "newcomer"].includes(postingCareer) &&
    profile.experienceYears > 1
  ) {
    return "changes" as const;
  }
  if (
    posting.career_min !== null &&
    profile.experienceYears < posting.career_min
  ) {
    return "changes" as const;
  }
  if (
    posting.career_max !== null &&
    profile.experienceYears > posting.career_max
  ) {
    return "changes" as const;
  }
  return "continues" as const;
}

function employmentMatches(posting: PostingSummary, profile: CareerProfile) {
  if (profile.employmentTypes.length === 0 || !posting.employment_type) return false;
  const value = posting.employment_type.toLocaleLowerCase("en-US");
  return profile.employmentTypes.some((type) => {
    if (type === "full_time") return value.includes("full_time") || value.includes("regular");
    if (type === "freelance") return value.includes("freelanc");
    return value.includes(type);
  });
}

function connectionForPosting(
  posting: PostingSummary,
  profile: CareerProfile,
  ownedSkills: string[],
  profileEvidence: Map<string, ProfileDomainEvidence>,
): CareerJobConnection {
  const postingDomains = classifyPostingDomains(posting).filter(
    (candidate) => !profile.excludedDomains.includes(candidate.domain),
  );
  const allPostingSkills = normalizedSkills(posting);
  const matchedSkills = skillMatches(allPostingSkills, ownedSkills);
  const ownedKeys = new Set(ownedSkills.map(skillIdentityKey));
  const unconfirmedRequiredSkills = (posting.required_skills ?? []).filter(
    (skill) => !ownedKeys.has(skillIdentityKey(skill)),
  );
  const profileResponsibilities = normalizedText(
    profile.responsibilities,
    profile.keepExperience,
    ...profile.experienceHighlights.flatMap((highlight) => [
      highlight.title,
      highlight.responsibilities,
      highlight.outcome,
    ]),
  );
  const postingText = normalizedText(posting.title, posting.description_excerpt);
  const matchedResponsibilities = commonResponsibilityWords(
    profileResponsibilities,
    postingText,
  );
  const matchedIndustries = profile.industryExperience.filter((industry) =>
    postingText.includes(industry.toLocaleLowerCase("ko-KR")),
  );

  const ranked = postingDomains.map((postingDomain) => {
    const evidence = profileEvidence.get(postingDomain.domain)!;
    const careerCondition = careerConditionFor(posting, profile);
    const matchedWorkTypes = profile.workTypes.filter((workType) =>
      postingDomain.inferredWorkTypes.includes(workType),
    );
    const coreEvidence = unique([
      ...evidence.evidenceTypes.filter((type) =>
        ["role", "responsibility", "achievement"].includes(type),
      ),
      ...(matchedResponsibilities.length > 0 ? ["responsibility"] : []),
      ...(matchedIndustries.length > 0 ? ["industry"] : []),
    ]) as CareerEvidenceType[];
    const supportingEvidence = unique([
      ...(matchedSkills.length > 0 ? ["skill"] : []),
      ...(matchedWorkTypes.length > 0 ? ["workType"] : []),
      ...(careerCondition === "continues" ? ["career"] : []),
      ...(profile.preferredLocations.some((location) =>
        normalizedText(posting.location).includes(location.toLocaleLowerCase("ko-KR")),
      )
        ? ["location"]
        : []),
      ...(employmentMatches(posting, profile) ? ["employment"] : []),
      ...(evidence.kind === "interest" ? ["interest"] : []),
    ]) as CareerEvidenceType[];
    const eligible =
      postingDomain.explicitRole &&
      coreEvidence.length > 0 &&
      (supportingEvidence.length > 0 || coreEvidence.length > 1);
    const internalStrength =
      coreEvidence.length * 10 +
      supportingEvidence.length * 2 +
      matchedSkills.length +
      (profile.currentDomain === postingDomain.domain ? 8 : 0) +
      (evidence.kind === "direct" ? 6 : evidence.kind === "adjacent" ? 3 : 0);
    return {
      postingDomain,
      profileDomain: evidence,
      matchedWorkTypes,
      coreEvidence,
      supportingEvidence,
      eligible,
      internalStrength,
    };
  }).sort(
    (left, right) =>
      Number(right.eligible) - Number(left.eligible) ||
      right.internalStrength - left.internalStrength ||
      KIND_RANK[left.profileDomain.kind] - KIND_RANK[right.profileDomain.kind],
  );

  const best = ranked[0];
  const hasProfile = Boolean(
    profile.currentRole ||
      profile.responsibilities ||
      profile.experienceHighlights.length > 0 ||
      ownedSkills.length > 0,
  );
  if (!hasProfile) {
    return {
      postingId: posting.id,
      directionId: null,
      directionLabel: null,
      directionKind: null,
      connectionLevel: "unconfigured",
      label: "프로필과 비교 전",
      recommendationEligible: false,
      reasons: ["현재 직무나 해온 업무를 입력하면 공고와 비교할 수 있습니다."],
      evidenceTypes: [],
      matchedSkills,
      matchedResponsibilities,
      matchedIndustries,
      matchedWorkTypes: [],
      unconfirmedRequiredSkills,
      unconfirmedConditions: unconfirmedRequiredSkills,
      careerCondition: careerConditionFor(posting, profile),
    };
  }

  if (!best) {
    return {
      postingId: posting.id,
      directionId: null,
      directionLabel: null,
      directionKind: null,
      connectionLevel: "limited",
      label: matchedSkills.length > 0 ? "기술 일부만 확인됨" : "추가 확인이 필요한 공고",
      recommendationEligible: false,
      reasons: [
        matchedSkills.length === 1
          ? `${matchedSkills[0]} 한 항목이 겹치지만 공고의 역할·업무와 이어지는 근거는 확인되지 않았습니다.`
          : "현재 프로필에서 공고의 역할·업무와 이어지는 근거를 확인하지 못했습니다.",
      ],
      evidenceTypes: matchedSkills.length > 0 ? ["skill"] : [],
      matchedSkills,
      matchedResponsibilities,
      matchedIndustries,
      matchedWorkTypes: [],
      unconfirmedRequiredSkills,
      unconfirmedConditions: unconfirmedRequiredSkills,
      careerCondition: careerConditionFor(posting, profile),
    };
  }

  const connectionLevel: CareerConnectionLevel = best.eligible
    ? best.profileDomain.kind === "direct"
      ? "direct"
      : best.profileDomain.kind === "interest"
        ? "interest"
        : "adjacent"
    : "limited";
  const evidenceTypes = unique([
    ...best.coreEvidence,
    ...best.supportingEvidence,
  ]) as CareerEvidenceType[];
  const limitedReason = !best.eligible
    ? matchedSkills.length === 1
      ? `${matchedSkills[0]} 한 항목이 겹치지만 공고의 역할·업무와 이어지는 근거는 확인되지 않았습니다.`
      : !best.postingDomain.explicitRole
        ? "기술 조건은 일부 겹치지만 공고의 역할·업무 근거는 확인되지 않았습니다."
        : "현재 프로필에서 공고의 역할·업무와 이어지는 근거를 더 확인해야 합니다."
    : null;
  const reasons = unique([
    ...(limitedReason ? [limitedReason] : []),
    ...best.profileDomain.reasons,
    ...(matchedResponsibilities.length > 0
      ? [`${matchedResponsibilities.join(", ")} 업무 표현이 공고 내용과 겹칩니다.`]
      : []),
    ...(matchedIndustries.length > 0
      ? [`${matchedIndustries.join(", ")} 산업 경험이 공고 내용에서 확인됩니다.`]
      : []),
    ...(matchedSkills.length > 0
      ? [`${matchedSkills.slice(0, 4).join(", ")} 기술 경험이 공고 조건과 겹칩니다.`]
      : []),
    ...matchedSkills.flatMap((skill) => {
      const usage = profile.skillUsage[skill];
      if (!usage) return [];
      if (usage.lastUsed === "current") {
        return [`${skill}은 현재 사용 중인 기술로 입력되어 있습니다.`];
      }
      if (usage.years !== null) {
        return [`${skill} 사용 기간 ${usage.years}년이 프로필에 확인됩니다.`];
      }
      return [];
    }),
  ]).slice(0, 3);

  return {
    postingId: posting.id,
    directionId: best.postingDomain.domain,
    directionLabel: best.postingDomain.label,
    directionKind: best.profileDomain.kind,
    connectionLevel,
    label:
      connectionLevel === "direct"
        ? "현재 경력과 직접 이어짐"
        : connectionLevel === "adjacent"
          ? "경험 활용도가 높은 인접 분야"
          : connectionLevel === "interest"
            ? "관심 분야에서 확인한 공고"
            : matchedSkills.length > 0
              ? "기술 일부만 확인됨"
              : "추가 확인이 필요한 공고",
    recommendationEligible: best.eligible,
    reasons:
      reasons.length > 0
        ? reasons
        : ["현재 프로필에서 공고의 역할·업무 근거를 더 확인해야 합니다."],
    evidenceTypes,
    matchedSkills,
    matchedResponsibilities,
    matchedIndustries,
    matchedWorkTypes: best.matchedWorkTypes,
    unconfirmedRequiredSkills,
    unconfirmedConditions: unconfirmedRequiredSkills,
    careerCondition: careerConditionFor(posting, profile),
  };
}

export type CareerDirection = {
  domain: string;
  label: string;
  kind: CareerDirectionKind;
  reasons: string[];
  evidenceTypes: CareerEvidenceType[];
  matchedSkills: string[];
  postingCount: number;
  companyCount: number;
  careerCounts: {
    newComer: number;
    experienced: number;
    mixedOrUnknown: number;
  };
  representativeTasks: string[];
  additionalRequirements: string[];
  representativeJob: {
    id: string;
    title: string;
    companyName: string;
    href: string;
  } | null;
};

function profileFieldsUsed(profile: CareerProfile, ownedSkills: string[]) {
  const used: string[] = [];
  if (profile.currentRole) used.push("currentRole");
  if (profile.pastRoles.length > 0) used.push("pastRoles");
  if (profile.responsibilities) used.push("responsibilities");
  if (profile.experienceHighlights.length > 0) used.push("experienceHighlights");
  if (profile.workTypes.length > 0) used.push("workTypes");
  if (profile.industryExperience.length > 0) used.push("industryExperience");
  if (profile.experienceYears !== null) used.push("experienceYears");
  if (profile.careerLevel) used.push("careerLevel");
  if (ownedSkills.length > 0) used.push("ownedSkills");
  if (Object.keys(profile.skillUsage).length > 0) used.push("skillUsage");
  if (profile.interestDomains.length > 0) used.push("interestDomains");
  if (profile.excludedDomains.length > 0) used.push("excludedDomains");
  if (profile.preferredLocations.length > 0) used.push("preferredLocations");
  if (profile.employmentTypes.length > 0) used.push("employmentTypes");
  return used;
}

function snapshotId(
  profile: CareerProfile,
  ownedSkills: string[],
  postings: PostingSummary[],
) {
  const value = JSON.stringify({
    version: CAREER_ANALYSIS_VERSION,
    profile,
    ownedSkills: [...ownedSkills].sort(),
    postings: postings
      .map((posting) => [posting.id, posting.last_verified_at])
      .sort(([left], [right]) => left.localeCompare(right)),
  });
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `career-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function latestVerifiedAt(postings: PostingSummary[]) {
  return postings
    .map((posting) => posting.last_verified_at)
    .filter((value) => !Number.isNaN(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

export type CareerAnalysisResult = {
  version: typeof CAREER_ANALYSIS_VERSION;
  snapshotId: string;
  calculatedAt: string | null;
  directions: CareerDirection[];
  jobConnections: Record<string, CareerJobConnection>;
  recommendedJobs: PostingSummary[];
  profileEvidenceUsed: string[];
  profileInformationNotConfirmed: string[];
};

export function buildCareerAnalysis(input: {
  profile?: CareerProfile;
  ownedSkills: string[];
  postings: PostingSummary[];
}): CareerAnalysisResult {
  const profile = normalizeCareerProfile(input.profile ?? EMPTY_CAREER_PROFILE);
  const ownedSkills = unique([
    ...input.ownedSkills.map((skill) => skill.trim()),
    ...Object.keys(profile.skillUsage),
    ...profile.experienceHighlights.flatMap((highlight) => highlight.skills),
  ]);
  const postings = [...input.postings];
  const profileEvidence = new Map(
    DOMAIN_DEFINITIONS.map((definition) => [
      definition.id,
      profileDomainEvidence(profile, ownedSkills, definition),
    ]),
  );
  const jobConnections = Object.fromEntries(
    postings.map((posting) => [
      posting.id,
      connectionForPosting(posting, profile, ownedSkills, profileEvidence),
    ]),
  );
  const domainPostings = new Map<string, PostingSummary[]>();
  for (const posting of postings) {
    for (const domain of classifyPostingDomains(posting)) {
      if (profile.excludedDomains.includes(domain.domain)) continue;
      const values = domainPostings.get(domain.domain) ?? [];
      values.push(posting);
      domainPostings.set(domain.domain, values);
    }
  }

  const hasProfileInput = Boolean(
    profile.currentRole ||
      profile.responsibilities ||
      profile.experienceHighlights.length > 0 ||
      ownedSkills.length > 0,
  );
  const directionCandidates: CareerDirection[] = hasProfileInput
    ? [...domainPostings.entries()].map(([domain, fieldPostings]) => {
        const definition = DEFINITION_BY_ID.get(domain);
        const evidence = profileEvidence.get(domain)!;
        const representative = fieldPostings
          .filter((posting) => {
            const connection = jobConnections[posting.id];
            return (
              connection.recommendationEligible &&
              connection.directionId === domain &&
              connection.evidenceTypes.some((type) =>
                ["role", "responsibility", "achievement", "industry"].includes(type),
              )
            );
          })
          .sort((left, right) => {
            const leftConnection = jobConnections[left.id];
            const rightConnection = jobConnections[right.id];
            return (
              LEVEL_RANK[leftConnection.connectionLevel] -
                LEVEL_RANK[rightConnection.connectionLevel] ||
              Date.parse(right.last_verified_at) - Date.parse(left.last_verified_at)
            );
          })[0];
        const connections = fieldPostings
          .map((posting) => jobConnections[posting.id])
          .filter((connection) => connection.directionId === domain);
        const matchedSkills = unique(
          connections.flatMap((connection) => connection.matchedSkills),
        );
        const required = unique(
          fieldPostings.flatMap((posting) => posting.required_skills ?? []),
        ).filter(
          (skill) =>
            !new Set(ownedSkills.map(skillIdentityKey)).has(skillIdentityKey(skill)),
        );
        const careerCounts = fieldPostings.reduce(
          (counts, posting) => {
            if (posting.career_type === "new_comer") counts.newComer += 1;
            else if (posting.career_type === "experienced") counts.experienced += 1;
            else counts.mixedOrUnknown += 1;
            return counts;
          },
          { newComer: 0, experienced: 0, mixedOrUnknown: 0 },
        );
        const representativeTasks = unique(
          fieldPostings.flatMap((posting) =>
            classifyPostingDomains(posting)
              .filter((item) => item.domain === domain)
              .flatMap((item) => item.responsibilityTerms),
          ),
        ).slice(0, 4);
        return {
          domain,
          label: definition?.label ?? formatDomainLabel(domain),
          kind: evidence.kind,
          reasons: evidence.reasons.slice(0, 3),
          evidenceTypes: evidence.evidenceTypes,
          matchedSkills,
          postingCount: fieldPostings.length,
          companyCount: new Set(
            fieldPostings.map((posting) => stableCompanyIdentity(posting)),
          ).size,
          careerCounts,
          representativeTasks,
          additionalRequirements: required.slice(0, 6),
          representativeJob: representative
            ? {
                id: representative.id,
                title: representative.title,
                companyName: representative.company_name,
                href: `/jobs/${encodeURIComponent(representative.id)}`,
              }
            : null,
        };
      })
    : [];

  const meaningfulDirections = directionCandidates
    .filter(
      (direction) =>
        direction.kind !== "transition" || direction.postingCount > 0,
    )
    .sort(
      (left, right) =>
        KIND_RANK[left.kind] - KIND_RANK[right.kind] ||
        right.evidenceTypes.length - left.evidenceTypes.length ||
        right.postingCount - left.postingCount ||
        left.label.localeCompare(right.label, "ko-KR"),
    );
  const directions = [
    ...meaningfulDirections.filter((direction) => direction.kind !== "transition"),
    ...meaningfulDirections
      .filter((direction) => direction.kind === "transition")
      .slice(0, 2),
  ].slice(0, 8);
  const recommendedJobs = postings
    .filter((posting) => jobConnections[posting.id].recommendationEligible)
    .sort((left, right) => {
      const leftConnection = jobConnections[left.id];
      const rightConnection = jobConnections[right.id];
      return (
        LEVEL_RANK[leftConnection.connectionLevel] -
          LEVEL_RANK[rightConnection.connectionLevel] ||
        Date.parse(right.last_verified_at) - Date.parse(left.last_verified_at)
      );
    });
  const profileInformationNotConfirmed = [
    ...(!profile.currentRole ? ["현재 직무"] : []),
    ...(!profile.responsibilities && profile.experienceHighlights.length === 0
      ? ["주요 업무 또는 프로젝트·성과 경험"]
      : []),
    ...(profile.experienceYears === null ? ["경력 기간"] : []),
  ];

  return {
    version: CAREER_ANALYSIS_VERSION,
    snapshotId: snapshotId(profile, ownedSkills, postings),
    calculatedAt: latestVerifiedAt(postings),
    directions,
    jobConnections,
    recommendedJobs,
    profileEvidenceUsed: profileFieldsUsed(profile, ownedSkills),
    profileInformationNotConfirmed,
  };
}
