import {
  CommunityDataError,
  MAX_COMMUNITY_COMMENT_LENGTH,
  MAX_COMMUNITY_POST_BODY_LENGTH,
  MAX_COMMUNITY_POST_TITLE_LENGTH,
  isCommunityCategory,
  isCommunityUuid,
  normalizeCommunityTags,
  normalizeCommunityText,
  type CommunityAuthor,
  type CommunityComment,
  type CommunityPost,
} from "@/lib/community-contract";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new CommunityDataError();
}

function mappedTimestamp(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return invalid();
  }
  return new Date(value).toISOString();
}

function mappedTrimmedText(value: unknown, maximumLength: number) {
  const normalized = normalizeCommunityText(value, maximumLength);
  if (!normalized || normalized !== value) return invalid();
  return normalized;
}

function mappedAuthor(value: unknown, expectedId: string): CommunityAuthor {
  const candidate = Array.isArray(value)
    ? value.length === 1
      ? value[0]
      : null
    : value;
  if (!isRecord(candidate) || candidate.user_id !== expectedId) {
    return invalid();
  }

  const nickname = candidate.nickname;
  if (nickname === null) return { id: expectedId, nickname: null };
  const normalizedNickname = normalizeCommunityText(nickname, 20);
  if (
    !normalizedNickname ||
    normalizedNickname.length < 2 ||
    normalizedNickname !== nickname
  ) {
    return invalid();
  }
  return { id: expectedId, nickname: normalizedNickname };
}

function mappedCounter(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return invalid();
  return value as number;
}

export function mapCommunityPostRow(value: unknown): CommunityPost {
  if (!isRecord(value)) return invalid();
  if (!isCommunityUuid(value.id) || !isCommunityUuid(value.author_id)) {
    return invalid();
  }
  if (!isCommunityCategory(value.category)) return invalid();

  const rawTags = value.tags;
  if (!Array.isArray(rawTags)) return invalid();
  const tags = normalizeCommunityTags(rawTags);
  if (!tags || tags.some((tag, index) => tag !== rawTags[index])) {
    return invalid();
  }

  return {
    id: value.id,
    author: mappedAuthor(value.author, value.author_id),
    category: value.category,
    title: mappedTrimmedText(value.title, MAX_COMMUNITY_POST_TITLE_LENGTH),
    body: mappedTrimmedText(value.body, MAX_COMMUNITY_POST_BODY_LENGTH),
    tags,
    metrics: {
      reactions: mappedCounter(value.reaction_count),
      comments: mappedCounter(value.comment_count),
      saves: mappedCounter(value.save_count),
    },
    createdAt: mappedTimestamp(value.created_at),
    updatedAt: mappedTimestamp(value.updated_at),
  };
}

export function mapCommunityCommentRow(value: unknown): CommunityComment {
  if (!isRecord(value)) return invalid();
  if (
    !isCommunityUuid(value.id) ||
    !isCommunityUuid(value.post_id) ||
    !isCommunityUuid(value.author_id)
  ) {
    return invalid();
  }

  return {
    id: value.id,
    postId: value.post_id,
    author: mappedAuthor(value.author, value.author_id),
    body: mappedTrimmedText(value.body, MAX_COMMUNITY_COMMENT_LENGTH),
    createdAt: mappedTimestamp(value.created_at),
    updatedAt: mappedTimestamp(value.updated_at),
  };
}

export function mapCommunityPostMembershipRows(
  value: unknown,
  viewerId: string,
) {
  if (!Array.isArray(value) || !isCommunityUuid(viewerId)) return invalid();
  const ids = new Set<string>();
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      candidate.user_id !== viewerId ||
      !isCommunityUuid(candidate.post_id)
    ) {
      return invalid();
    }
    ids.add(candidate.post_id);
  }
  return Array.from(ids);
}

export function mapCommunityFollowRows(value: unknown, viewerId: string) {
  if (!Array.isArray(value) || !isCommunityUuid(viewerId)) return invalid();
  const ids = new Set<string>();
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      candidate.follower_id !== viewerId ||
      !isCommunityUuid(candidate.followed_id)
    ) {
      return invalid();
    }
    ids.add(candidate.followed_id);
  }
  return Array.from(ids);
}
