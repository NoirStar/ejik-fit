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
  normalizeCommunityCursor,
  normalizeCommunitySearchQuery,
  normalizeCommunityTags,
  normalizeCommunityText,
  type CommunityComment,
  type CommunityCursor,
  type CommunityPage,
  type CommunityPost,
  type CommunityViewerState,
  type CreateCommunityCommentInput,
  type CreateCommunityPostInput,
  type CreateCommunityReportInput,
  type UpdateCommunityPostInput,
} from "@/lib/community-contract";

import {
  mapCommunityCommentRow,
  mapCommunityFollowRows,
  mapCommunityPostMembershipRows,
  mapCommunityPostRow,
  mapCommunitySearchPostRow,
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
  "author:user_profiles!community_posts_author_id_fkey(user_id,nickname)",
].join(",");

const COMMENT_COLUMNS = [
  "id",
  "post_id",
  "author_id",
  "body",
  "created_at",
  "updated_at",
  "author:user_profiles!community_comments_author_id_fkey(user_id,nickname)",
].join(",");

const DEFAULT_POST_LIMIT = 20;
const MAX_POST_LIMIT = 50;
const DEFAULT_COMMENT_LIMIT = 50;
const MAX_COMMENT_LIMIT = 50;

export const COMMUNITY_FAILURE_COPY = {
  invalid: "작성 내용을 확인해 주세요.",
  auth: "로그인한 뒤 다시 시도해 주세요.",
  connection: "커뮤니티에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  create: "글을 게시하지 못했습니다. 작성 내용은 그대로 두었습니다.",
  update: "수정 내용을 저장하지 못했습니다. 작성 내용은 그대로 두었습니다.",
  comment: "댓글을 등록하지 못했습니다. 작성 내용은 그대로 두었습니다.",
} as const;

export type CommunityStore = {
  searchPosts(options: {
    query: string;
    before?: CommunityCursor;
    limit?: number;
  }): Promise<CommunityPage<CommunityPost>>;
  listPostPage(options?: {
    authorId?: string;
    before?: CommunityCursor;
    limit?: number;
  }): Promise<CommunityPage<CommunityPost>>;
  listFollowingPostPage(options?: {
    before?: CommunityCursor;
    limit?: number;
  }): Promise<CommunityPage<CommunityPost>>;
  listSavedPostPage(options?: {
    before?: CommunityCursor;
    limit?: number;
  }): Promise<CommunityPage<CommunityPost>>;
  listPosts(options?: {
    authorId?: string;
    limit?: number;
  }): Promise<CommunityPost[]>;
  listSavedPosts(viewerId: string, limit?: number): Promise<CommunityPost[]>;
  getPost(postId: string): Promise<CommunityPost | null>;
  getComment(commentId: string): Promise<CommunityComment | null>;
  listCommentPage(options: {
    postId: string;
    before?: CommunityCursor;
    limit?: number;
  }): Promise<CommunityPage<CommunityComment>>;
  listComments(postId: string, limit?: number): Promise<CommunityComment[]>;
  loadViewerState(
    viewerId: string,
    targets: { postIds: string[]; authorIds: string[] },
  ): Promise<CommunityViewerState>;
  createPost(
    authorId: string,
    input: CreateCommunityPostInput,
  ): Promise<CommunityPost>;
  updatePost(
    authorId: string,
    postId: string,
    input: UpdateCommunityPostInput,
  ): Promise<CommunityPost>;
  deletePost(authorId: string, postId: string): Promise<void>;
  createComment(
    authorId: string,
    postId: string,
    input: CreateCommunityCommentInput,
  ): Promise<CommunityComment>;
  updateComment(
    authorId: string,
    commentId: string,
    body: string,
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
    COMMUNITY_FAILURE_COPY.invalid,
  );
}

function requireDeletedRow(value: unknown, expectedId: string) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    value.id !== expectedId
  ) {
    throw new CommunityStoreError(
      "not_found",
      "이미 삭제되었거나 접근할 수 없습니다.",
    );
  }
}

function requiredUuid(value: unknown) {
  if (!isCommunityUuid(value)) return invalidInput();
  return value;
}

function requiredCursor(value: unknown) {
  const cursor = normalizeCommunityCursor(value);
  if (!cursor) return invalidInput();
  return cursor;
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
  if (
    code === "42501" ||
    code === "PGRST116" ||
    code === "PGRST301" ||
    code === "PGRST302"
  ) {
    throw new CommunityStoreError(
      "permission",
      COMMUNITY_FAILURE_COPY.auth,
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
    COMMUNITY_FAILURE_COPY.connection,
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
      COMMUNITY_FAILURE_COPY.connection,
    );
  }
  return value.map(mapper);
}

function mappedMembershipCursor(value: unknown, id: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunityStoreError(
      "invalid_data",
      COMMUNITY_FAILURE_COPY.connection,
    );
  }
  const createdAt = (value as Record<string, unknown>).membership_created_at;
  const cursor = normalizeCommunityCursor({ createdAt, id });
  if (!cursor) {
    throw new CommunityStoreError(
      "invalid_data",
      COMMUNITY_FAILURE_COPY.connection,
    );
  }
  return cursor;
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

function normalizedPostUpdateInput(input: UpdateCommunityPostInput) {
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
  return { category: input.category, title, body, tags };
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
  async function listPostPage(options: {
    authorId?: string;
    before?: CommunityCursor;
    limit?: number;
  } = {}): Promise<CommunityPage<CommunityPost>> {
    const limit = boundedLimit(
      options.limit,
      DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const authorId =
      options.authorId === undefined
        ? null
        : requiredUuid(options.authorId);
    const before =
      options.before === undefined ? null : requiredCursor(options.before);
    let request = client.from(POST_TABLE).select(POST_COLUMNS);
    if (authorId) {
      request = request.eq("author_id", authorId);
    }
    if (before) {
      request = request.or(
        `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`,
      );
    }
    const { data, error } = await request
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (error) databaseFailure(error);
    const mapped = mappedRows(data, mapCommunityPostRow);
    const items = mapped.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        mapped.length > limit && last
          ? { createdAt: last.createdAt, id: last.id }
          : null,
    };
  }

  async function listCommentPage(options: {
    postId: string;
    before?: CommunityCursor;
    limit?: number;
  }): Promise<CommunityPage<CommunityComment>> {
    const limit = boundedLimit(
      options.limit,
      DEFAULT_COMMENT_LIMIT,
      MAX_COMMENT_LIMIT,
    );
    const postId = requiredUuid(options.postId);
    const before =
      options.before === undefined ? null : requiredCursor(options.before);
    let request = client
      .from(COMMENT_TABLE)
      .select(COMMENT_COLUMNS)
      .eq("post_id", postId);
    if (before) {
      request = request.or(
        `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`,
      );
    }
    const { data, error } = await request
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (error) databaseFailure(error);
    const mapped = mappedRows(data, mapCommunityCommentRow);
    const items = mapped.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        mapped.length > limit && last
          ? { createdAt: last.createdAt, id: last.id }
          : null,
    };
  }

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
    async searchPosts(options) {
      const query = normalizeCommunitySearchQuery(options.query);
      if (!query) invalidInput();
      const before =
        options.before === undefined ? null : requiredCursor(options.before);
      const limit = boundedLimit(
        options.limit,
        DEFAULT_POST_LIMIT,
        MAX_POST_LIMIT,
      );
      const { data, error } = await client.rpc("search_community_posts", {
        search_query: query,
        before_created_at: before?.createdAt ?? null,
        before_id: before?.id ?? null,
        result_limit: limit + 1,
      });
      if (error) databaseFailure(error);
      const mapped = mappedRows(data, mapCommunitySearchPostRow);
      const items = mapped.slice(0, limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          mapped.length > limit && last
            ? { createdAt: last.createdAt, id: last.id }
            : null,
      };
    },

    listPostPage,

    async listFollowingPostPage(options = {}) {
      const before =
        options.before === undefined ? null : requiredCursor(options.before);
      const limit = boundedLimit(
        options.limit,
        DEFAULT_POST_LIMIT,
        MAX_POST_LIMIT,
      );
      const { data, error } = await client.rpc(
        "list_community_following_posts",
        {
          before_created_at: before?.createdAt ?? null,
          before_id: before?.id ?? null,
          result_limit: limit + 1,
        },
      );
      if (error) databaseFailure(error);
      const mapped = mappedRows(data, mapCommunitySearchPostRow);
      const items = mapped.slice(0, limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          mapped.length > limit && last
            ? { createdAt: last.createdAt, id: last.id }
            : null,
      };
    },

    async listSavedPostPage(options = {}) {
      const before =
        options.before === undefined ? null : requiredCursor(options.before);
      const limit = boundedLimit(
        options.limit,
        DEFAULT_POST_LIMIT,
        MAX_POST_LIMIT,
      );
      const { data, error } = await client.rpc("list_community_saved_posts", {
        before_created_at: before?.createdAt ?? null,
        before_id: before?.id ?? null,
        result_limit: limit + 1,
      });
      if (error) databaseFailure(error);
      const rows = Array.isArray(data) ? data : null;
      if (!rows) {
        throw new CommunityStoreError(
          "invalid_data",
          COMMUNITY_FAILURE_COPY.connection,
        );
      }
      const mapped = rows.map(mapCommunitySearchPostRow);
      const items = mapped.slice(0, limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          mapped.length > limit && last
            ? mappedMembershipCursor(rows[items.length - 1], last.id)
            : null,
      };
    },

    async listPosts(options = {}) {
      return (await listPostPage(options)).items;
    },

    async listSavedPosts(viewerId, requestedLimit) {
      const scopedViewerId = requiredUuid(viewerId);
      const limit = boundedLimit(
        requestedLimit,
        DEFAULT_POST_LIMIT,
        MAX_POST_LIMIT,
      );
      const { data: membershipData, error: membershipError } = await client
        .from(SAVE_TABLE)
        .select("post_id,user_id")
        .eq("user_id", scopedViewerId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (membershipError) databaseFailure(membershipError);

      const savedPostIds = mapCommunityPostMembershipRows(
        membershipData,
        scopedViewerId,
      );
      if (savedPostIds.length === 0) return [];

      const { data, error } = await client
        .from(POST_TABLE)
        .select(POST_COLUMNS)
        .in("id", savedPostIds)
        .limit(limit);
      if (error) databaseFailure(error);

      const byId = new Map(
        mappedRows(data, mapCommunityPostRow).map((post) => [post.id, post]),
      );
      return savedPostIds.flatMap((id) => {
        const post = byId.get(id);
        return post ? [post] : [];
      });
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

    async getComment(commentId) {
      const { data, error } = await client
        .from(COMMENT_TABLE)
        .select(COMMENT_COLUMNS)
        .eq("id", requiredUuid(commentId))
        .maybeSingle();
      if (error) databaseFailure(error);
      return data === null ? null : mapCommunityCommentRow(data);
    },

    listCommentPage,

    async listComments(postId, requestedLimit) {
      const page = await listCommentPage({
        postId,
        ...(requestedLimit === undefined ? {} : { limit: requestedLimit }),
      });
      return page.items.toReversed();
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

    async updatePost(authorId, postId, input) {
      const normalized = normalizedPostUpdateInput(input);
      const { data, error } = await client
        .from(POST_TABLE)
        .update(normalized)
        .eq("author_id", requiredUuid(authorId))
        .eq("id", requiredUuid(postId))
        .select(POST_COLUMNS)
        .single();
      if (error) databaseFailure(error);
      return mapCommunityPostRow(data);
    },

    async deletePost(authorId, postId) {
      const scopedPostId = requiredUuid(postId);
      const { data, error } = await client
        .from(POST_TABLE)
        .delete()
        .eq("author_id", requiredUuid(authorId))
        .eq("id", scopedPostId)
        .select("id")
        .maybeSingle();
      if (error) databaseFailure(error);
      requireDeletedRow(data, scopedPostId);
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

    async updateComment(authorId, commentId, body) {
      const normalizedBody = normalizeCommunityText(
        body,
        MAX_COMMUNITY_COMMENT_LENGTH,
      );
      if (!normalizedBody) invalidInput();
      const { data, error } = await client
        .from(COMMENT_TABLE)
        .update({ body: normalizedBody })
        .eq("author_id", requiredUuid(authorId))
        .eq("id", requiredUuid(commentId))
        .select(COMMENT_COLUMNS)
        .single();
      if (error) databaseFailure(error);
      return mapCommunityCommentRow(data);
    },

    async deleteComment(authorId, commentId) {
      const scopedCommentId = requiredUuid(commentId);
      const { data, error } = await client
        .from(COMMENT_TABLE)
        .delete()
        .eq("author_id", requiredUuid(authorId))
        .eq("id", scopedCommentId)
        .select("id")
        .maybeSingle();
      if (error) databaseFailure(error);
      requireDeletedRow(data, scopedCommentId);
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
