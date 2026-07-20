import {
  readSocialInteractions,
  removePostSocialInteractions,
} from "./social-interactions";

const KEY = "ejik-fit:local-community-posts";
const CHANGE_EVENT = "ejik-fit:local-community-posts-change";

export const MAX_LOCAL_COMMUNITY_POSTS = 30;
export const MAX_LOCAL_COMMUNITY_POST_TITLE_LENGTH = 80;
export const MAX_LOCAL_COMMUNITY_POST_BODY_LENGTH = 1200;
export const MAX_LOCAL_COMMUNITY_POST_TAGS = 4;
const MAX_TAG_LENGTH = 40;

export const LOCAL_COMMUNITY_POST_CATEGORIES = [
  "커리어 질문",
  "커리어 고민",
  "면접 후기",
] as const;
export type LocalCommunityPostCategory =
  (typeof LOCAL_COMMUNITY_POST_CATEGORIES)[number];
export const DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY: LocalCommunityPostCategory =
  "커리어 질문";

export type LocalCommunityPost = {
  id: string;
  category?: LocalCommunityPostCategory;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
};

export type LocalCommunityPostDraft = {
  category?: LocalCommunityPostCategory;
  title: string;
  body: string;
  tags: string[];
};

type CreateLocalCommunityPostOptions = {
  storage?: Storage | null;
  id?: string;
  createdAt?: string;
};

type LocalCommunityPostListener = (posts: LocalCommunityPost[]) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isLocalCommunityPostId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 140 &&
    /^local-[a-z0-9][a-z0-9-]*$/i.test(value)
  );
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const rawTag of value) {
    if (typeof rawTag !== "string") continue;
    const tag = rawTag.trim();
    const key = tag.toLocaleLowerCase("ko-KR");
    if (!tag || tag.length > MAX_TAG_LENGTH || seen.has(key)) continue;
    tags.push(tag);
    seen.add(key);
    if (tags.length === MAX_LOCAL_COMMUNITY_POST_TAGS) break;
  }
  return tags;
}

function normalizeCategory(
  value: unknown,
): LocalCommunityPostCategory | undefined {
  return LOCAL_COMMUNITY_POST_CATEGORIES.find((category) => category === value);
}

function normalizePost(value: unknown): LocalCommunityPost | null {
  if (!isRecord(value) || !isLocalCommunityPostId(value.id)) return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";
  const createdAt =
    typeof value.createdAt === "string" ? value.createdAt.trim() : "";
  if (
    !title ||
    title.length > MAX_LOCAL_COMMUNITY_POST_TITLE_LENGTH ||
    !body ||
    body.length > MAX_LOCAL_COMMUNITY_POST_BODY_LENGTH ||
    !createdAt ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }
  const category = normalizeCategory(value.category);
  return {
    id: value.id,
    ...(category ? { category } : {}),
    title,
    body,
    tags: normalizeTags(value.tags),
    createdAt: new Date(createdAt).toISOString(),
  };
}

export function normalizeLocalCommunityPosts(
  value: unknown,
): LocalCommunityPost[] {
  if (!Array.isArray(value)) return [];
  const candidates = value
    .map(normalizePost)
    .filter((post): post is LocalCommunityPost => post !== null)
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        left.id.localeCompare(right.id),
    );
  const posts = new Map<string, LocalCommunityPost>();
  for (const post of candidates) {
    if (!posts.has(post.id)) posts.set(post.id, post);
    if (posts.size === MAX_LOCAL_COMMUNITY_POSTS) break;
  }
  return Array.from(posts.values());
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLocalCommunityPosts(
  storage = defaultStorage(),
): LocalCommunityPost[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    return raw ? normalizeLocalCommunityPosts(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
}

function notifyLocalCommunityPosts(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function writeLocalCommunityPosts(
  value: LocalCommunityPost[],
  storage = defaultStorage(),
): LocalCommunityPost[] {
  const normalized = normalizeLocalCommunityPosts(value);
  if (!storage) return [];
  try {
    storage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    return readLocalCommunityPosts(storage);
  }
  notifyLocalCommunityPosts(storage);
  return normalized;
}

function localPostId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalCommunityPost(
  draft: LocalCommunityPostDraft,
  options: CreateLocalCommunityPostOptions = {},
): { posts: LocalCommunityPost[]; post: LocalCommunityPost | null } {
  const storage =
    options.storage === undefined ? defaultStorage() : options.storage;
  const current = readLocalCommunityPosts(storage);
  const candidate = normalizePost({
    ...draft,
    id: options.id ?? localPostId(),
    createdAt: options.createdAt ?? new Date().toISOString(),
  });
  if (!candidate) return { posts: current, post: null };

  const posts = writeLocalCommunityPosts(
    [candidate, ...current.filter((post) => post.id !== candidate.id)],
    storage,
  );
  return {
    posts,
    post: posts.find((post) => post.id === candidate.id) ?? null,
  };
}

export function removeLocalCommunityPost(
  postId: string,
  storage = defaultStorage(),
): { posts: LocalCommunityPost[]; removed: boolean } {
  const current = readLocalCommunityPosts(storage);
  if (!isLocalCommunityPostId(postId) || !current.some((post) => post.id === postId)) {
    return { posts: current, removed: false };
  }
  const posts = writeLocalCommunityPosts(
    current.filter((post) => post.id !== postId),
    storage,
  );
  return { posts, removed: !posts.some((post) => post.id === postId) };
}

function hasPostInteractions(postId: string, storage: Storage | null) {
  const interactions = readSocialInteractions(storage);
  return (
    interactions.reactedPostIds.includes(postId) ||
    interactions.savedPostIds.includes(postId) ||
    Boolean(interactions.commentsByPostId[postId]?.length)
  );
}

export function deleteLocalCommunityPost(
  postId: string,
  storage = defaultStorage(),
): {
  posts: LocalCommunityPost[];
  status: "removed" | "not_found" | "interactions_failed" | "post_failed";
} {
  const posts = readLocalCommunityPosts(storage);
  if (!posts.some((post) => post.id === postId)) {
    return { posts, status: "not_found" };
  }

  if (hasPostInteractions(postId, storage)) {
    removePostSocialInteractions(postId, storage);
    if (hasPostInteractions(postId, storage)) {
      return { posts, status: "interactions_failed" };
    }
  }

  const result = removeLocalCommunityPost(postId, storage);
  return {
    posts: result.posts,
    status: result.removed ? "removed" : "post_failed",
  };
}

export function clearLocalCommunityPosts(
  storage = defaultStorage(),
): LocalCommunityPost[] {
  if (!storage) return [];
  try {
    storage.removeItem(KEY);
  } catch {
    return readLocalCommunityPosts(storage);
  }
  notifyLocalCommunityPosts(storage);
  return [];
}

export function subscribeLocalCommunityPosts(
  listener: LocalCommunityPostListener,
) {
  if (typeof window === "undefined") return () => undefined;

  const emitCurrent = () => listener(readLocalCommunityPosts());
  const handleStorage = (event: StorageEvent) => {
    const browserStorage = defaultStorage();
    if (
      (event.key === KEY || event.key === null) &&
      (!event.storageArea || event.storageArea === browserStorage)
    ) {
      emitCurrent();
    }
  };

  window.addEventListener(CHANGE_EVENT, emitCurrent);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, emitCurrent);
    window.removeEventListener("storage", handleStorage);
  };
}
