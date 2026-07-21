import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CommunityStoreError,
  MAX_COMMUNITY_COMMENT_LENGTH,
  MAX_COMMUNITY_POST_BODY_LENGTH,
  MAX_COMMUNITY_POST_TITLE_LENGTH,
  MAX_COMMUNITY_REPORT_DETAILS_LENGTH,
  isCommunityCategory,
  isCommunityReportReason,
  isCommunityReportTarget,
  isCommunityUuid,
  normalizeCommunityClientOrigin,
  normalizeCommunityTags,
  normalizeCommunityText,
  type CommunityComment,
  type CommunityPost,
  type CommunityViewerState,
  type CreateCommunityCommentInput,
  type CreateCommunityPostInput,
  type CreateCommunityReportInput,
} from "@/lib/community-contract";

import {
  mapCommunityCommentRow,
  mapCommunityFollowRows,
  mapCommunityPostMembershipRows,
  mapCommunityPostRow,
} from "./community-mapper";

const POST_TABLE = "community_posts";
const COMMENT_TABLE = "community_comments";
const REACTION_TABLE = "community_post_reactions";
const SAVE_TABLE = "community_post_saves";
const FOLLOW_TABLE = "community_author_follows";
const REPORT_TABLE = "community_reports";

const POST_COLUMNS = [
  "id",
  "author_id",
  "category",
  "title",
  "body",
  "tags",
  "reaction_count",
  "comment_count",
  "save_count",
  "created_at",
  "updated_at",
  "author:user_profiles(user_id,nickname)",
].join(",");

const COMMENT_COLUMNS = [
  "id",
  "post_id",
  "author_id",
  "body",
  "created_at",
  "updated_at",
  "author:user_profiles(user_id,nickname)",
].join(",");

const DEFAULT_POST_LIMIT = 20;
const MAX_POST_LIMIT = 50;
const DEFAULT_COMMENT_LIMIT = 50;
const MAX_COMMENT_LIMIT = 50;

export type CommunityStore = {
  listPosts(options?: {
    authorId?: string;
    limit?: number;
  }): Promise<CommunityPost[]>;
  getPost(postId: string): Promise<CommunityPost | null>;
  listComments(postId: string, limit?: number): Promise<CommunityComment[]>;
  loadViewerState(
    viewerId: string,
    targets: { postIds: string[]; authorIds: string[] },
  ): Promise<CommunityViewerState>;
  createPost(
    authorId: string,
    input: CreateCommunityPostInput,
  ): Promise<CommunityPost>;
  deletePost(authorId: string, postId: string): Promise<void>;
  createComment(
    authorId: string,
    postId: string,
    input: CreateCommunityCommentInput,
  ): Promise<CommunityComment>;
  deleteComment(authorId: string, commentId: string): Promise<void>;
  setPostReaction(
    userId: string,
    postId: string,
    active: boolean,
  ): Promise<void>;
  setPostSaved(
    userId: string,
    postId: string,
    active: boolean,
  ): Promise<void>;
  setAuthorFollowed(
    followerId: string,
    followedId: string,
    active: boolean,
    id?: string,
  ): Promise<void>;
  createReport(
    reporterId: string,
    input: CreateCommunityReportInput,
  ): Promise<void>;
};

function invalidInput(): never {
  throw new CommunityStoreError(
    "invalid_data",
    "입력한 커뮤니티 내용을 확인해주세요.",
  );
}

function requiredUuid(value: unknown) {
  if (!isCommunityUuid(value)) return invalidInput();
  return value;
}

function generatedUuid(value?: string) {
  return value === undefined
    ? globalThis.crypto.randomUUID()
    : requiredUuid(value);
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value)));
}

function uniqueUuids(values: string[]) {
  const ids = new Set<string>();
  for (const value of values) ids.add(requiredUuid(value));
  return Array.from(ids);
}

function errorCode(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const code = (value as Record<string, unknown>).code;
  return typeof code === "string" ? code : "";
}

function databaseFailure(error: unknown): never {
  const code = errorCode(error);
  if (code === "42501" || code === "PGRST301" || code === "PGRST302") {
    throw new CommunityStoreError(
      "permission",
      "로그인 상태와 작업 권한을 확인해주세요.",
      { cause: error },
    );
  }
  if (code === "23505") {
    throw new CommunityStoreError(
      "conflict",
      "이미 처리된 커뮤니티 활동입니다.",
      { cause: error },
    );
  }
  throw new CommunityStoreError(
    "unavailable",
    "커뮤니티 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
    { cause: error },
  );
}

function mappedRows<T>(
  value: unknown,
  mapper: (candidate: unknown) => T,
): T[] {
  if (!Array.isArray(value)) {
    throw new CommunityStoreError(
      "invalid_data",
      "커뮤니티 데이터 형식이 올바르지 않습니다.",
    );
  }
  return value.map(mapper);
}

function normalizedPostInput(input: CreateCommunityPostInput) {
  if (!isCommunityCategory(input.category)) return invalidInput();
  const title = normalizeCommunityText(
    input.title,
    MAX_COMMUNITY_POST_TITLE_LENGTH,
  );
  const body = normalizeCommunityText(
    input.body,
    MAX_COMMUNITY_POST_BODY_LENGTH,
  );
  const tags = normalizeCommunityTags(input.tags);
  if (!title || !body || !tags) return invalidInput();

  const clientOriginId = normalizeCommunityClientOrigin(input.clientOriginId);
  if (input.clientOriginId !== undefined && !clientOriginId) {
    return invalidInput();
  }
  return {
    id: generatedUuid(input.id),
    category: input.category,
    title,
    body,
    tags,
    ...(clientOriginId ? { clientOriginId } : {}),
  };
}

function normalizedCommentInput(input: CreateCommunityCommentInput) {
  const body = normalizeCommunityText(input.body, MAX_COMMUNITY_COMMENT_LENGTH);
  if (!body) return invalidInput();
  const clientOriginId = normalizeCommunityClientOrigin(input.clientOriginId);
  if (input.clientOriginId !== undefined && !clientOriginId) {
    return invalidInput();
  }
  return {
    id: generatedUuid(input.id),
    body,
    ...(clientOriginId ? { clientOriginId } : {}),
  };
}

export function createSupabaseCommunityStore(
  client: SupabaseClient,
): CommunityStore {
  async function setPostMembership(
    table: typeof REACTION_TABLE | typeof SAVE_TABLE,
    userId: string,
    postId: string,
    active: boolean,
  ) {
    const scopedUserId = requiredUuid(userId);
    const scopedPostId = requiredUuid(postId);
    const request = active
      ? client.from(table).upsert(
          { post_id: scopedPostId, user_id: scopedUserId },
          {
            ignoreDuplicates: true,
            onConflict: "post_id,user_id",
          },
        )
      : client
          .from(table)
          .delete()
          .eq("user_id", scopedUserId)
          .eq("post_id", scopedPostId);
    const { error } = await request;
    if (error) databaseFailure(error);
  }

  return {
    async listPosts(options = {}) {
      const limit = boundedLimit(
        options.limit,
        DEFAULT_POST_LIMIT,
        MAX_POST_LIMIT,
      );
      let request = client.from(POST_TABLE).select(POST_COLUMNS);
      if (options.authorId !== undefined) {
        request = request.eq("author_id", requiredUuid(options.authorId));
      }
      const { data, error } = await request
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) databaseFailure(error);
      return mappedRows(data, mapCommunityPostRow);
    },

    async getPost(postId) {
      const { data, error } = await client
        .from(POST_TABLE)
        .select(POST_COLUMNS)
        .eq("id", requiredUuid(postId))
        .maybeSingle();
      if (error) databaseFailure(error);
      return data === null ? null : mapCommunityPostRow(data);
    },

    async listComments(postId, requestedLimit) {
      const limit = boundedLimit(
        requestedLimit,
        DEFAULT_COMMENT_LIMIT,
        MAX_COMMENT_LIMIT,
      );
      const { data, error } = await client
        .from(COMMENT_TABLE)
        .select(COMMENT_COLUMNS)
        .eq("post_id", requiredUuid(postId))
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) databaseFailure(error);
      return mappedRows(data, mapCommunityCommentRow);
    },

    async loadViewerState(viewerId, targets) {
      const scopedViewerId = requiredUuid(viewerId);
      const postIds = uniqueUuids(targets.postIds);
      const authorIds = uniqueUuids(targets.authorIds);

      const loadPostMembership = async (
        table: typeof REACTION_TABLE | typeof SAVE_TABLE,
      ) => {
        if (postIds.length === 0) return [];
        const { data, error } = await client
          .from(table)
          .select("post_id,user_id")
          .eq("user_id", scopedViewerId)
          .in("post_id", postIds);
        if (error) databaseFailure(error);
        return mapCommunityPostMembershipRows(data, scopedViewerId);
      };

      const loadFollows = async () => {
        if (authorIds.length === 0) return [];
        const { data, error } = await client
          .from(FOLLOW_TABLE)
          .select("follower_id,followed_id")
          .eq("follower_id", scopedViewerId)
          .in("followed_id", authorIds);
        if (error) databaseFailure(error);
        return mapCommunityFollowRows(data, scopedViewerId);
      };

      const [reactedPostIds, savedPostIds, followedAuthorIds] =
        await Promise.all([
          loadPostMembership(REACTION_TABLE),
          loadPostMembership(SAVE_TABLE),
          loadFollows(),
        ]);
      return { reactedPostIds, savedPostIds, followedAuthorIds };
    },

    async createPost(authorId, input) {
      const scopedAuthorId = requiredUuid(authorId);
      const normalized = normalizedPostInput(input);
      const { data, error } = await client
        .from(POST_TABLE)
        .insert({
          id: normalized.id,
          author_id: scopedAuthorId,
          category: normalized.category,
          title: normalized.title,
          body: normalized.body,
          tags: normalized.tags,
          ...(normalized.clientOriginId
            ? { client_origin_id: normalized.clientOriginId }
            : {}),
        })
        .select(POST_COLUMNS)
        .single();
      if (error) databaseFailure(error);
      return mapCommunityPostRow(data);
    },

    async deletePost(authorId, postId) {
      const { error } = await client
        .from(POST_TABLE)
        .delete()
        .eq("author_id", requiredUuid(authorId))
        .eq("id", requiredUuid(postId));
      if (error) databaseFailure(error);
    },

    async createComment(authorId, postId, input) {
      const scopedAuthorId = requiredUuid(authorId);
      const scopedPostId = requiredUuid(postId);
      const normalized = normalizedCommentInput(input);
      const { data, error } = await client
        .from(COMMENT_TABLE)
        .insert({
          id: normalized.id,
          post_id: scopedPostId,
          author_id: scopedAuthorId,
          body: normalized.body,
          ...(normalized.clientOriginId
            ? { client_origin_id: normalized.clientOriginId }
            : {}),
        })
        .select(COMMENT_COLUMNS)
        .single();
      if (error) databaseFailure(error);
      return mapCommunityCommentRow(data);
    },

    async deleteComment(authorId, commentId) {
      const { error } = await client
        .from(COMMENT_TABLE)
        .delete()
        .eq("author_id", requiredUuid(authorId))
        .eq("id", requiredUuid(commentId));
      if (error) databaseFailure(error);
    },

    async setPostReaction(userId, postId, active) {
      await setPostMembership(REACTION_TABLE, userId, postId, active);
    },

    async setPostSaved(userId, postId, active) {
      await setPostMembership(SAVE_TABLE, userId, postId, active);
    },

    async setAuthorFollowed(
      followerId,
      followedId,
      active,
      requestedId,
    ) {
      const scopedFollowerId = requiredUuid(followerId);
      const scopedFollowedId = requiredUuid(followedId);
      if (scopedFollowerId === scopedFollowedId) invalidInput();
      const request = active
        ? client.from(FOLLOW_TABLE).upsert(
            {
              id: generatedUuid(requestedId),
              follower_id: scopedFollowerId,
              followed_id: scopedFollowedId,
            },
            {
              ignoreDuplicates: true,
              onConflict: "follower_id,followed_id",
            },
          )
        : client
            .from(FOLLOW_TABLE)
            .delete()
            .eq("follower_id", scopedFollowerId)
            .eq("followed_id", scopedFollowedId);
      const { error } = await request;
      if (error) databaseFailure(error);
    },

    async createReport(reporterId, input) {
      const scopedReporterId = requiredUuid(reporterId);
      if (
        !isCommunityReportTarget(input.targetType) ||
        !isCommunityReportReason(input.reason)
      ) {
        invalidInput();
      }
      const details =
        input.details === undefined
          ? undefined
          : normalizeCommunityText(
              input.details,
              MAX_COMMUNITY_REPORT_DETAILS_LENGTH,
            );
      if (input.details !== undefined && !details) invalidInput();

      const { error } = await client.from(REPORT_TABLE).insert({
        id: generatedUuid(input.id),
        reporter_id: scopedReporterId,
        target_type: input.targetType,
        target_id: requiredUuid(input.targetId),
        reason: input.reason,
        ...(details ? { details } : {}),
      });
      if (error) databaseFailure(error);
    },
  };
}
