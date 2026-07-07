import { formatCareer } from "@/lib/labels";
import type {
  PostingSummary,
  SkillGraphEvidence,
  SkillGraphNode,
} from "@/lib/types";

import type {
  DailyDashboardInput,
  DailyDashboardModel,
  DashboardJob,
  DashboardMode,
  MarketSignal,
} from "./types";


const TARGET_HOME_JOB_COUNT = 8;


function normalizeSkill(skill: string) {
  return skill.trim().toLowerCase();
}


function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}


function formatFreshness(value: string | null | undefined) {
  if (!value) {
    return "최근 확인";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "최근 확인";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}


function statusLabel(status: string | null | undefined) {
  if (!status) {
    return "상태 확인";
  }
  if (["open", "active", "published"].includes(status.toLowerCase())) {
    return "진행 중";
  }
  if (["closed", "expired"].includes(status.toLowerCase())) {
    return "마감";
  }
  return status;
}


function postingFallbackUrl(posting: PostingSummary | undefined) {
  return posting?.source_url ?? null;
}


function evidenceFitScore(evidence: SkillGraphEvidence, ownedSet: Set<string>) {
  const requiredMatches = evidence.required.filter((skill) =>
    ownedSet.has(normalizeSkill(skill)),
  ).length;
  const preferredMatches = evidence.preferred.filter((skill) =>
    ownedSet.has(normalizeSkill(skill)),
  ).length;
  const otherMatches = evidence.unspecified.filter((skill) =>
    ownedSet.has(normalizeSkill(skill)),
  ).length;
  const matchedCount = requiredMatches + preferredMatches + otherMatches;

  if (matchedCount === 0) {
    return 0;
  }

  return Math.min(
    96,
    52 + requiredMatches * 16 + preferredMatches * 10 + otherMatches * 6,
  );
}


function evidenceToDashboardJob(
  evidence: SkillGraphEvidence,
  posting: PostingSummary | undefined,
  ownedSet: Set<string>,
): DashboardJob | null {
  const matchedSkills = unique(
    evidence.skills.filter((skill) => ownedSet.has(normalizeSkill(skill))),
  ).slice(0, 3);

  if (matchedSkills.length === 0) {
    return null;
  }

  const missingSkills = unique(
    [...evidence.required, ...evidence.preferred].filter(
      (skill) => !ownedSet.has(normalizeSkill(skill)),
    ),
  ).slice(0, 5);
  const fitScore = evidenceFitScore(evidence, ownedSet);

  return {
    id: evidence.posting_id,
    title: posting?.title ?? evidence.title,
    companyName: posting?.company_name ?? evidence.company_name,
    location: posting?.location ?? "근무지 확인",
    careerLabel: formatCareer(posting?.career_type ?? null),
    statusLabel: statusLabel(posting?.status),
    freshnessLabel: formatFreshness(posting?.last_verified_at),
    sourceUrl: postingFallbackUrl(posting),
    fitScore,
    matchedSkills,
    missingSkills,
    recommendationReasons: [
      `${matchedSkills.join(", ")} 기술이 공고 요구와 연결됩니다.`,
      missingSkills.length > 0
        ? `${missingSkills[0]} 준비 여부를 확인하면 좋습니다.`
        : "현재 보유 스택과 직접 연결되는 공고입니다.",
    ],
    isSupplemental: false,
  };
}


function postingToSupplementalJob(posting: PostingSummary): DashboardJob {
  return {
    id: posting.id,
    title: posting.title,
    companyName: posting.company_name,
    location: posting.location ?? "근무지 확인",
    careerLabel: formatCareer(posting.career_type),
    statusLabel: statusLabel(posting.status),
    freshnessLabel: formatFreshness(posting.last_verified_at),
    sourceUrl: posting.source_url,
    fitScore: 0,
    matchedSkills: [],
    missingSkills: [],
    recommendationReasons: [
      "맞춤 공고가 부족해 전체 신규 공고에서 보충했습니다.",
    ],
    isSupplemental: true,
  };
}


function compareJobs(a: DashboardJob, b: DashboardJob) {
  if (a.isSupplemental !== b.isSupplemental) {
    return a.isSupplemental ? 1 : -1;
  }
  return b.fitScore - a.fitScore || a.companyName.localeCompare(b.companyName, "ko");
}


function buildTrendingSignals(input: DailyDashboardInput): MarketSignal[] {
  return (input.skillStats?.items ?? []).slice(0, 3).map((skill) => ({
    label: skill.skill,
    value: `${skill.count}건`,
    caption: "최근 공고 언급",
  }));
}


function buildCooccurringSignals(
  input: DailyDashboardInput,
  nodeMap: Map<string, SkillGraphNode>,
  ownedSet: Set<string>,
): MarketSignal[] {
  const signals = (input.graph?.edges ?? [])
    .flatMap((edge) => {
      const sourceOwned = ownedSet.has(normalizeSkill(edge.source));
      const targetOwned = ownedSet.has(normalizeSkill(edge.target));
      if (sourceOwned === targetOwned) {
        return [];
      }
      const otherId = sourceOwned ? edge.target : edge.source;
      const node = nodeMap.get(otherId);
      if (!node) {
        return [];
      }
      return [{
        label: node.label,
        value: `${edge.cooccurrence_count}개`,
        caption: "내 스택과 함께 요구",
      }];
    })
    .sort((a, b) => Number.parseInt(b.value, 10) - Number.parseInt(a.value, 10));

  return signals.slice(0, 3);
}


function countGapSkills(jobs: DashboardJob[]) {
  return new Set(
    jobs.flatMap((job) => job.missingSkills.map(normalizeSkill)),
  ).size;
}


export function buildDailyDashboardModel(
  input: DailyDashboardInput,
): DailyDashboardModel {
  const ownedSkills = input.ownedSkills.length > 0
    ? input.ownedSkills
    : ["C++", "Python", "Linux"];
  const ownedSet = new Set(ownedSkills.map(normalizeSkill));
  const postings = input.postings?.items ?? [];
  const postingMap = new Map(postings.map((posting) => [posting.id, posting]));
  const nodeMap = new Map((input.graph?.nodes ?? []).map((node) => [node.id, node]));

  const matchedJobs = (input.graph?.evidence ?? [])
    .map((evidence) =>
      evidenceToDashboardJob(evidence, postingMap.get(evidence.posting_id), ownedSet),
    )
    .filter((job): job is DashboardJob => Boolean(job))
    .sort(compareJobs);

  const usedIds = new Set(matchedJobs.map((job) => job.id));
  const supplementalJobs = postings
    .filter((posting) => !usedIds.has(posting.id))
    .map(postingToSupplementalJob)
    .slice(0, Math.max(0, TARGET_HOME_JOB_COUNT - matchedJobs.length));

  const jobs = [...matchedJobs, ...supplementalJobs].slice(0, TARGET_HOME_JOB_COUNT);
  const mode: DashboardMode =
    jobs.length === 0
      ? "empty"
      : matchedJobs.length === jobs.length
        ? "personalized"
        : "supplemented";
  const highFitJobCount = jobs.filter((job) => job.fitScore >= 80).length;
  const gapSkillCount = countGapSkills(jobs);

  return {
    mode,
    ownedSkills,
    jobs,
    summary: {
      matchedJobCount: matchedJobs.length,
      highFitJobCount,
      gapSkillCount,
      actionItemCount: highFitJobCount + Math.min(gapSkillCount, 3),
    },
    trendingSkills: buildTrendingSignals(input),
    cooccurringSkills: buildCooccurringSignals(input, nodeMap, ownedSet),
    updatedLabel: formatFreshness(input.now?.toISOString()),
  };
}
