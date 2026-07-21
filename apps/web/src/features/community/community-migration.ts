import { CommunityStoreError } from "@/lib/community-contract";
import {
  deleteLocalCommunityPost,
  readLocalCommunityPosts,
} from "@/lib/local-community-posts";
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
  failedPostIds: string[];
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
  const interactions = readSocialInteractions(storage);
  const result: CommunityMigrationResult = {
    migratedPostIds: [],
    failedPostIds: [],
  };

  for (const localPost of posts) {
    try {
      const serverPost = await ensurePost(store, userId, localPost);
      for (const comment of interactions.commentsByPostId[localPost.id] ?? []) {
        await ensureComment(
          store,
          userId,
          serverPost.id,
          localPost.id,
          comment,
        );
      }
      if (interactions.reactedPostIds.includes(localPost.id)) {
        await store.setPostReaction(userId, serverPost.id, true);
      }
      if (interactions.savedPostIds.includes(localPost.id)) {
        await store.setPostSaved(userId, serverPost.id, true);
      }

      const deletion = deleteLocalCommunityPost(localPost.id, storage);
      if (deletion.status !== "removed") {
        throw new Error(`local cleanup failed: ${deletion.status}`);
      }
      result.migratedPostIds.push(localPost.id);
    } catch {
      result.failedPostIds.push(localPost.id);
    }
  }

  return result;
}
