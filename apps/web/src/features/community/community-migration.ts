import { CommunityStoreError } from "@/lib/community-contract";
import {
  deleteLocalCommunityPost,
  readLocalCommunityPosts,
} from "@/lib/local-community-posts";
import {
  acquireLocalCommunityMigrationLease,
  ownsLocalCommunityMigrationLease,
  releaseLocalCommunityMigrationLease,
} from "@/lib/local-community-migration-lock";
import { readSocialInteractions } from "@/lib/social-interactions";

import type { CommunityStore } from "./community-store";

type CommunityMigrationStore = Pick<
  CommunityStore,
  | "createComment"
  | "createPost"
  | "getComment"
  | "getPost"
  | "setPostReaction"
  | "setPostSaved"
>;

export type CommunityMigrationResult = {
  migratedPostIds: string[];
  failures: Array<{
    localPostId: string;
    message: string;
  }>;
};

function bytesToUuid(bytes: Uint8Array) {
  const hex = Array.from(bytes.slice(0, 16), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Produces an opaque, repeatable UUID for retry-safe browser-to-account moves.
 * Version 8 marks the UUID as application-defined rather than a random UUID.
 */
export async function deterministicCommunityUuid(seed: string) {
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`ejik-fit-community:${seed}`),
    ),
  );
  digest[6] = (digest[6] & 0x0f) | 0x80;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  return bytesToUuid(digest);
}

function isConflict(error: unknown) {
  return error instanceof CommunityStoreError && error.code === "conflict";
}

function migrationFailureMessage(error: unknown) {
  return error instanceof CommunityStoreError
    ? error.message
    : "계정으로 옮기지 못했습니다.";
}

type LocalMigrationSnapshot = {
  post: ReturnType<typeof readLocalCommunityPosts>[number];
  reacted: boolean;
  saved: boolean;
  comments: NonNullable<
    ReturnType<typeof readSocialInteractions>["commentsByPostId"][string]
  >;
};

function migrationSnapshot(
  localPost: LocalMigrationSnapshot["post"],
  interactions: ReturnType<typeof readSocialInteractions>,
): LocalMigrationSnapshot {
  return {
    post: localPost,
    reacted: interactions.reactedPostIds.includes(localPost.id),
    saved: interactions.savedPostIds.includes(localPost.id),
    comments: interactions.commentsByPostId[localPost.id] ?? [],
  };
}

function currentSnapshot(
  localPostId: string,
  storage?: Storage | null,
): LocalMigrationSnapshot | null {
  const post = readLocalCommunityPosts(storage).find(
    (candidate) => candidate.id === localPostId,
  );
  return post ? migrationSnapshot(post, readSocialInteractions(storage)) : null;
}

function snapshotsMatch(
  left: LocalMigrationSnapshot,
  right: LocalMigrationSnapshot | null,
) {
  return right !== null && JSON.stringify(left) === JSON.stringify(right);
}

async function ensurePost(
  store: CommunityMigrationStore,
  userId: string,
  localPost: ReturnType<typeof readLocalCommunityPosts>[number],
) {
  const serverId = await deterministicCommunityUuid(
    `post:${userId}:${localPost.id}`,
  );
  try {
    return await store.createPost(userId, {
      id: serverId,
      category: localPost.category ?? "커리어 질문",
      title: localPost.title,
      body: localPost.body,
      tags: localPost.tags,
      clientOriginId: localPost.id,
    });
  } catch (error) {
    if (!isConflict(error)) throw error;
    const existing = await store.getPost(serverId);
    if (!existing || existing.author.id !== userId) throw error;
    return existing;
  }
}

async function ensureComment(
  store: CommunityMigrationStore,
  userId: string,
  serverPostId: string,
  localPostId: string,
  localComment: ReturnType<typeof readSocialInteractions>["commentsByPostId"][string][number],
) {
  const serverId = await deterministicCommunityUuid(
    `comment:${userId}:${localPostId}:${localComment.id}`,
  );
  try {
    return await store.createComment(userId, serverPostId, {
      id: serverId,
      body: localComment.body,
      clientOriginId: localComment.id,
    });
  } catch (error) {
    if (!isConflict(error)) throw error;
    const existing = await store.getComment(serverId);
    if (
      !existing ||
      existing.author.id !== userId ||
      existing.postId !== serverPostId
    ) {
      throw error;
    }
    return existing;
  }
}

export async function migrateLocalCommunityContent(
  store: CommunityMigrationStore,
  userId: string,
  storage?: Storage | null,
): Promise<CommunityMigrationResult> {
  const posts = readLocalCommunityPosts(storage);
  const result: CommunityMigrationResult = {
    migratedPostIds: [],
    failures: [],
  };

  for (const initialPost of posts) {
    const lease = acquireLocalCommunityMigrationLease(initialPost.id, storage);
    if (!lease) {
      result.failures.push({
        localPostId: initialPost.id,
        message: "다른 탭에서 이 글을 계정으로 옮기고 있습니다.",
      });
      continue;
    }
    try {
      const localPost = readLocalCommunityPosts(storage).find(
        (candidate) => candidate.id === initialPost.id,
      );
      if (!localPost) continue;
      const snapshot = migrationSnapshot(
        localPost,
        readSocialInteractions(storage),
      );
      const serverPost = await ensurePost(store, userId, localPost);
      for (const comment of snapshot.comments) {
        await ensureComment(
          store,
          userId,
          serverPost.id,
          localPost.id,
          comment,
        );
      }
      await store.setPostReaction(userId, serverPost.id, snapshot.reacted);
      await store.setPostSaved(userId, serverPost.id, snapshot.saved);

      if (
        !ownsLocalCommunityMigrationLease(localPost.id, lease, storage) ||
        !snapshotsMatch(snapshot, currentSnapshot(localPost.id, storage))
      ) {
        throw new CommunityStoreError(
          "conflict",
          "이전 중 새 활동이 확인되어 브라우저 원본을 유지했습니다.",
        );
      }

      const deletion = deleteLocalCommunityPost(localPost.id, storage);
      if (deletion.status !== "removed") {
        throw new Error(`local cleanup failed: ${deletion.status}`);
      }
      result.migratedPostIds.push(localPost.id);
    } catch (error) {
      result.failures.push({
        localPostId: initialPost.id,
        message: migrationFailureMessage(error),
      });
    } finally {
      releaseLocalCommunityMigrationLease(initialPost.id, lease, storage);
    }
  }

  return result;
}
