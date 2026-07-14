import type {
  CommunityPostFeedItem,
  InterviewReviewFeedItem,
} from "@/features/home-feed/types";
import {
  buildJobEvidence,
  formatCareerRange,
  formatClosingDate,
  formatVerifiedDate,
} from "@/features/jobs/model";
import { formatEmployment } from "@/lib/labels";
import { validatedHttpUrl } from "@/lib/safe-url";
import type { PostingDetail } from "@/lib/types";

export const MAX_SAVED_JOB_LOOKUPS = 24;

type CommunityItem = CommunityPostFeedItem | InterviewReviewFeedItem;

export type SavedJobItem = {
  id: string;
  title: string;
  companyName: string;
  companyHref: string | null;
  detailHref: string;
  sourceUrl: string;
  careerLabel: string;
  employmentLabel: string;
  location: string;
  status: string;
  statusLabel: string;
  verifiedLabel: string;
  closingLabel: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  unspecifiedSkills: string[];
};

export type SavedCommunityItem = {
  id: string;
  category: string;
  title: string;
  summary: string;
  authorName: string;
  authorHeadline: string;
  createdLabel: string;
  tags: string[];
  href: string;
  source: "mock";
};

export type SavedJobData = {
  items: SavedJobItem[];
  unavailableIds: string[];
  failedIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function statusLabel(status: string) {
  if (status === "open") return "공개 중";
  if (status === "closed" || status === "expired") return "마감";
  return "상태 확인 필요";
}

export function buildSavedJobItem(posting: PostingDetail): SavedJobItem {
  const evidence = buildJobEvidence(posting, []);
  return {
    id: posting.id,
    title: posting.title,
    companyName: posting.company_name,
    companyHref: posting.company_slug
      ? `/companies/${encodeURIComponent(posting.company_slug)}`
      : null,
    detailHref: `/jobs/${encodeURIComponent(posting.id)}`,
    sourceUrl: posting.source_url,
    careerLabel: formatCareerRange(posting),
    employmentLabel: formatEmployment(posting.employment_type),
    location: posting.location?.trim() || "지역 미기재",
    status: posting.status,
    statusLabel: statusLabel(posting.status),
    verifiedLabel: formatVerifiedDate(posting.last_verified_at),
    closingLabel: formatClosingDate(posting.closes_at),
    requiredSkills: evidence.requiredSkills,
    preferredSkills: evidence.preferredSkills,
    unspecifiedSkills: evidence.unspecifiedSkills,
  };
}

export function normalizeSavedJobRequest(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.job_ids)) {
    throw new TypeError("Invalid saved job request");
  }
  if (value.job_ids.length > MAX_SAVED_JOB_LOOKUPS) {
    throw new TypeError("Too many saved job IDs");
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const valueId of value.job_ids) {
    if (typeof valueId !== "string") {
      throw new TypeError("Invalid saved job ID");
    }
    const id = valueId.trim();
    if (!id || id.length > 200) {
      throw new TypeError("Invalid saved job ID");
    }
    if (!seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }
  return ids;
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Invalid saved job field: ${key}`);
  }
  return value;
}

function stringList(value: unknown, key: string) {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) => typeof item !== "string" || item.trim().length === 0,
    )
  ) {
    throw new TypeError(`Invalid saved job field: ${key}`);
  }
  return value as string[];
}

function idList(value: unknown, key: string) {
  if (!Array.isArray(value) || value.length > MAX_SAVED_JOB_LOOKUPS) {
    throw new TypeError(`Invalid saved job response: ${key}`);
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !item.trim() || item.length > 200) {
      throw new TypeError(`Invalid saved job response: ${key}`);
    }
    if (!seen.has(item)) {
      ids.push(item);
      seen.add(item);
    }
  }
  return ids;
}

function savedJobItem(value: unknown): SavedJobItem {
  if (!isRecord(value)) throw new TypeError("Invalid saved job item");
  const id = requiredString(value, "id");
  const sourceUrl = requiredString(value, "sourceUrl");
  try {
    validatedHttpUrl(sourceUrl, "saved job source URL");
  } catch {
    throw new TypeError("Invalid saved job source URL");
  }

  const companyHref = value.companyHref;
  if (
    companyHref !== null &&
    (typeof companyHref !== "string" ||
      !/^\/companies\/[a-z0-9][a-z0-9-]{0,119}$/.test(companyHref))
  ) {
    throw new TypeError("Invalid saved job company href");
  }
  const detailHref = requiredString(value, "detailHref");
  if (detailHref !== `/jobs/${encodeURIComponent(id)}`) {
    throw new TypeError("Invalid saved job detail href");
  }
  const closingLabel = value.closingLabel;
  if (
    closingLabel !== null &&
    (typeof closingLabel !== "string" || closingLabel.trim().length === 0)
  ) {
    throw new TypeError("Invalid saved job closing label");
  }

  return {
    id,
    title: requiredString(value, "title"),
    companyName: requiredString(value, "companyName"),
    companyHref,
    detailHref,
    sourceUrl,
    careerLabel: requiredString(value, "careerLabel"),
    employmentLabel: requiredString(value, "employmentLabel"),
    location: requiredString(value, "location"),
    status: requiredString(value, "status"),
    statusLabel: requiredString(value, "statusLabel"),
    verifiedLabel: requiredString(value, "verifiedLabel"),
    closingLabel,
    requiredSkills: stringList(value.requiredSkills, "requiredSkills"),
    preferredSkills: stringList(value.preferredSkills, "preferredSkills"),
    unspecifiedSkills: stringList(
      value.unspecifiedSkills,
      "unspecifiedSkills",
    ),
  };
}

export function normalizeSavedJobDataResponse(value: unknown): SavedJobData {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new TypeError("Invalid saved job response");
  }
  if (value.items.length > MAX_SAVED_JOB_LOOKUPS) {
    throw new TypeError("Invalid saved job response size");
  }

  return {
    items: value.items.map(savedJobItem),
    unavailableIds: idList(value.unavailable_ids, "unavailable_ids"),
    failedIds: idList(value.failed_ids, "failed_ids"),
  };
}

function toSavedCommunityItem(item: CommunityItem): SavedCommunityItem {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    summary: item.type === "community_post" ? item.body : item.summary,
    authorName: item.authorName,
    authorHeadline: item.authorHeadline,
    createdLabel: item.createdLabel,
    tags: item.tags,
    href: item.href,
    source: "mock",
  };
}

export function selectSavedCommunityItems(
  savedIds: string[],
  communityItems: CommunityItem[],
) {
  const byId = new Map(communityItems.map((item) => [item.id, item]));
  const items: SavedCommunityItem[] = [];
  const unavailableIds: string[] = [];
  const seen = new Set<string>();

  for (const rawId of savedIds) {
    const id = rawId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const item = byId.get(id);
    if (!item || item.source !== "mock") {
      unavailableIds.push(id);
      continue;
    }
    items.push(toSavedCommunityItem(item));
  }

  return { items, unavailableIds };
}

