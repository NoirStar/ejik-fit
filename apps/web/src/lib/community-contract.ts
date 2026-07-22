export const COMMUNITY_CATEGORIES = [
  "커리어 질문",
  "커리어 고민",
  "면접 후기",
] as const;

export const COMMUNITY_REPORT_TARGETS = ["post", "comment"] as const;
export const COMMUNITY_REPORT_REASONS = [
  "spam",
  "harassment",
  "privacy",
  "misinformation",
  "other",
] as const;

export const MAX_COMMUNITY_POST_TITLE_LENGTH = 80;
export const MAX_COMMUNITY_POST_BODY_LENGTH = 1200;
export const MAX_COMMUNITY_POST_TAGS = 4;
export const MAX_COMMUNITY_TAG_LENGTH = 40;
export const MAX_COMMUNITY_COMMENT_LENGTH = 600;
export const MAX_COMMUNITY_REPORT_DETAILS_LENGTH = 500;
export const MAX_COMMUNITY_CLIENT_ORIGIN_LENGTH = 200;
export const MIN_COMMUNITY_SEARCH_QUERY_LENGTH = 2;
export const MAX_COMMUNITY_SEARCH_QUERY_LENGTH = 80;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];
export type CommunityReportTarget =
  (typeof COMMUNITY_REPORT_TARGETS)[number];
export type CommunityReportReason =
  (typeof COMMUNITY_REPORT_REASONS)[number];

export type CommunityAuthor = {
  id: string;
  nickname: string | null;
};

export type CommunityPost = {
  id: string;
  author: CommunityAuthor;
  category: CommunityCategory;
  title: string;
  body: string;
  tags: string[];
  metrics: {
    reactions: number;
    comments: number;
    saves: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type CommunityComment = {
  id: string;
  postId: string;
  author: CommunityAuthor;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunityViewerState = {
  reactedPostIds: string[];
  savedPostIds: string[];
  followedAuthorIds: string[];
};

export type CommunityCursor = {
  createdAt: string;
  id: string;
};

export type CommunityPage<T> = {
  items: T[];
  nextCursor: CommunityCursor | null;
};

export type CreateCommunityPostInput = {
  id?: string;
  category: CommunityCategory;
  title: string;
  body: string;
  tags: string[];
  clientOriginId?: string;
};

export type UpdateCommunityPostInput = {
  category: CommunityCategory;
  title: string;
  body: string;
  tags: string[];
};

export type CreateCommunityCommentInput = {
  id?: string;
  body: string;
  clientOriginId?: string;
};

export type CreateCommunityReportInput = {
  id?: string;
  targetType: CommunityReportTarget;
  targetId: string;
  reason: CommunityReportReason;
  details?: string;
};

export class CommunityDataError extends Error {
  constructor() {
    super("커뮤니티 데이터 형식이 올바르지 않습니다.");
    this.name = "CommunityDataError";
  }
}

export type CommunityStoreErrorCode =
  | "conflict"
  | "invalid_data"
  | "not_found"
  | "permission"
  | "unavailable";

export class CommunityStoreError extends Error {
  readonly code: CommunityStoreErrorCode;

  constructor(
    code: CommunityStoreErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CommunityStoreError";
    this.code = code;
  }
}

export function isCommunityCategory(
  value: unknown,
): value is CommunityCategory {
  return COMMUNITY_CATEGORIES.some((category) => category === value);
}

export function isCommunityReportTarget(
  value: unknown,
): value is CommunityReportTarget {
  return COMMUNITY_REPORT_TARGETS.some((target) => target === value);
}

export function isCommunityReportReason(
  value: unknown,
): value is CommunityReportReason {
  return COMMUNITY_REPORT_REASONS.some((reason) => reason === value);
}

export function isCommunityUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function normalizeCommunityText(
  value: unknown,
  maximumLength: number,
) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximumLength
    ? normalized
    : null;
}

export function normalizeCommunityTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_COMMUNITY_POST_TAGS) {
    return null;
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const valueItem of value) {
    const tag = normalizeCommunityText(valueItem, MAX_COMMUNITY_TAG_LENGTH);
    if (!tag) return null;
    const key = tag.toLocaleLowerCase("ko-KR");
    if (seen.has(key)) return null;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function normalizeCommunityClientOrigin(value: unknown) {
  if (value === undefined || value === null) return null;
  return normalizeCommunityText(value, MAX_COMMUNITY_CLIENT_ORIGIN_LENGTH);
}

export function normalizeCommunityCursor(
  value: unknown,
): CommunityCursor | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!isCommunityUuid(candidate.id) || typeof candidate.createdAt !== "string") {
    return null;
  }
  const timestamp = Date.parse(candidate.createdAt);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== candidate.createdAt
  ) {
    return null;
  }
  return { createdAt: candidate.createdAt, id: candidate.id };
}

export function normalizeCommunitySearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= MIN_COMMUNITY_SEARCH_QUERY_LENGTH &&
    normalized.length <= MAX_COMMUNITY_SEARCH_QUERY_LENGTH
    ? normalized
    : null;
}
