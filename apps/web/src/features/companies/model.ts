import { buildJobEvidence } from "@/features/jobs/model";
import { formatCareer, formatEmployment } from "@/lib/labels";
import type { PostingSummary } from "@/lib/types";

export type CompanySkillEvidence = {
  name: string;
  postingCount: number;
  requiredCount: number;
  preferredCount: number;
  unspecifiedCount: number;
};

export type CompanyDistributionItem = {
  label: string;
  count: number;
};

export type CompanyHiringSnapshot = {
  companyName: string | null;
  postingCount: number;
  uniqueSkillCount: number;
  locationCount: number;
  latestVerifiedAt: string | null;
  skills: CompanySkillEvidence[];
  careers: CompanyDistributionItem[];
  employmentTypes: CompanyDistributionItem[];
  locations: CompanyDistributionItem[];
};

function evidenceKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function buildDistribution(values: string[]): CompanyDistributionItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label, "ko-KR"),
  );
}

function latestValidDate(postings: PostingSummary[]) {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const posting of postings) {
    const time = Date.parse(posting.last_verified_at);
    if (Number.isNaN(time) || time <= latestTime) continue;
    latest = posting.last_verified_at;
    latestTime = time;
  }
  return latest;
}

export function buildCompanyHiringSnapshot(
  postings: PostingSummary[],
): CompanyHiringSnapshot {
  const skills = new Map<string, CompanySkillEvidence>();

  for (const posting of postings) {
    const evidence = buildJobEvidence(posting, []);
    const groups = [
      ["requiredCount", evidence.requiredSkills],
      ["preferredCount", evidence.preferredSkills],
      ["unspecifiedCount", evidence.unspecifiedSkills],
    ] as const;

    for (const [counter, values] of groups) {
      for (const value of values) {
        const key = evidenceKey(value);
        if (!key) continue;
        const current = skills.get(key) ?? {
          name: value.trim(),
          postingCount: 0,
          requiredCount: 0,
          preferredCount: 0,
          unspecifiedCount: 0,
        };
        current[counter] += 1;
        current.postingCount += 1;
        skills.set(key, current);
      }
    }
  }

  const orderedSkills = Array.from(skills.values()).sort(
    (left, right) =>
      right.postingCount - left.postingCount ||
      right.requiredCount - left.requiredCount ||
      right.preferredCount - left.preferredCount ||
      left.name.localeCompare(right.name, "en-US"),
  );
  const knownLocations = new Set(
    postings
      .map((posting) => posting.location?.trim() ?? "")
      .filter(Boolean)
      .map(evidenceKey),
  );

  return {
    companyName:
      postings
        .map((posting) => posting.company_name.trim())
        .find(Boolean) ?? null,
    postingCount: postings.length,
    uniqueSkillCount: orderedSkills.length,
    locationCount: knownLocations.size,
    latestVerifiedAt: latestValidDate(postings),
    skills: orderedSkills,
    careers: buildDistribution(
      postings.map((posting) => formatCareer(posting.career_type)),
    ),
    employmentTypes: buildDistribution(
      postings.map((posting) => formatEmployment(posting.employment_type)),
    ),
    locations: buildDistribution(
      postings.map((posting) => posting.location?.trim() || "근무지 미기재"),
    ),
  };
}
