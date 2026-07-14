const KEY = "ejik-fit:social-interactions";
const CHANGE_EVENT = "ejik-fit:social-interactions-change";
const MAX_IDS = 200;
const MAX_POSTS_WITH_COMMENTS = 100;
const MAX_COMMENTS_PER_POST = 50;
export const MAX_LOCAL_COMMENT_LENGTH = 600;

export type LocalPostComment = {
  id: string;
  body: string;
  createdAt: string;
};

export type SocialInteractions = {
  reactedPostIds: string[];
  savedPostIds: string[];
  commentsByPostId: Record<string, LocalPostComment[]>;
};

type SocialInteractionsListener = (state: SocialInteractions) => void;

type AddLocalPostCommentOptions = {
  storage?: Storage | null;
  id?: string;
  createdAt?: string;
};

export const EMPTY_SOCIAL_INTERACTIONS: SocialInteractions = {
  reactedPostIds: [],
  savedPostIds: [],
  commentsByPostId: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedId(value: unknown) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.length > 0 && id.length <= 200 ? id : null;
}

function normalizedIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(normalizedId).filter((id): id is string => id !== null)),
  )
    .sort((left, right) => left.localeCompare(right))
    .slice(0, MAX_IDS);
}

function normalizedComment(value: unknown): LocalPostComment | null {
  if (!isRecord(value)) return null;
  const id = normalizedId(value.id);
  const body = typeof value.body === "string" ? value.body.trim() : "";
  const createdAt =
    typeof value.createdAt === "string" ? value.createdAt : "";
  if (
    !id ||
    body.length === 0 ||
    body.length > MAX_LOCAL_COMMENT_LENGTH ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }
  return { id, body, createdAt };
}

function normalizedComments(value: unknown) {
  if (!Array.isArray(value)) return [];
  const comments = new Map<string, LocalPostComment>();
  for (const rawComment of value) {
    const comment = normalizedComment(rawComment);
    if (comment) comments.set(comment.id, comment);
  }
  return Array.from(comments.values())
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .slice(-MAX_COMMENTS_PER_POST);
}

export function normalizeSocialInteractions(value: unknown): SocialInteractions {
  if (!isRecord(value)) {
    return {
      reactedPostIds: [],
      savedPostIds: [],
      commentsByPostId: {},
    };
  }

  const commentsByPostId: Record<string, LocalPostComment[]> = {};
  if (isRecord(value.commentsByPostId)) {
    for (const [rawPostId, rawComments] of Object.entries(
      value.commentsByPostId,
    ).slice(0, MAX_POSTS_WITH_COMMENTS)) {
      const postId = normalizedId(rawPostId);
      const comments = normalizedComments(rawComments);
      if (postId && comments.length > 0) {
        commentsByPostId[postId] = normalizedComments([
          ...(commentsByPostId[postId] ?? []),
          ...comments,
        ]);
      }
    }
  }

  return {
    reactedPostIds: normalizedIds(value.reactedPostIds),
    savedPostIds: normalizedIds(value.savedPostIds),
    commentsByPostId,
  };
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSocialInteractions(
  storage = defaultStorage(),
): SocialInteractions {
  if (!storage) return normalizeSocialInteractions(null);
  try {
    const raw = storage.getItem(KEY);
    return raw ? normalizeSocialInteractions(JSON.parse(raw)) : normalizeSocialInteractions(null);
  } catch {
    return normalizeSocialInteractions(null);
  }
}

function notifySocialInteractions(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function clearSocialInteractions(
  storage = defaultStorage(),
): SocialInteractions {
  if (!storage) return normalizeSocialInteractions(null);
  try {
    storage.removeItem(KEY);
  } catch {
    return readSocialInteractions(storage);
  }
  notifySocialInteractions(storage);
  return normalizeSocialInteractions(null);
}

export function writeSocialInteractions(
  value: SocialInteractions,
  storage = defaultStorage(),
): SocialInteractions {
  const normalized = normalizeSocialInteractions(value);
  if (!storage) return normalizeSocialInteractions(null);
  try {
    storage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    return readSocialInteractions(storage);
  }
  notifySocialInteractions(storage);
  return normalized;
}

function togglePostId(
  field: "reactedPostIds" | "savedPostIds",
  postId: string,
  storage: Storage | null,
) {
  const id = normalizedId(postId);
  const current = readSocialInteractions(storage);
  if (!id) return current;
  const ids = current[field];
  return writeSocialInteractions(
    {
      ...current,
      [field]: ids.includes(id)
        ? ids.filter((savedId) => savedId !== id)
        : [...ids, id],
    },
    storage,
  );
}

export function togglePostReaction(
  postId: string,
  storage = defaultStorage(),
) {
  return togglePostId("reactedPostIds", postId, storage);
}

export function togglePostSave(postId: string, storage = defaultStorage()) {
  return togglePostId("savedPostIds", postId, storage);
}

function localCommentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now().toString(36)}`;
}

export function addLocalPostComment(
  postId: string,
  body: string,
  options: AddLocalPostCommentOptions = {},
): { state: SocialInteractions; comment: LocalPostComment | null } {
  const storage =
    options.storage === undefined ? defaultStorage() : options.storage;
  const current = readSocialInteractions(storage);
  const id = normalizedId(postId);
  const comment = normalizedComment({
    id: options.id ?? localCommentId(),
    body,
    createdAt: options.createdAt ?? new Date().toISOString(),
  });
  if (!id || !comment) return { state: current, comment: null };

  const comments = current.commentsByPostId[id] ?? [];
  const state = writeSocialInteractions(
    {
      ...current,
      commentsByPostId: {
        ...current.commentsByPostId,
        [id]: [...comments.filter((item) => item.id !== comment.id), comment],
      },
    },
    storage,
  );
  const persisted = state.commentsByPostId[id]?.find(
    (item) => item.id === comment.id,
  );
  return { state, comment: persisted ?? null };
}

export function subscribeSocialInteractions(
  listener: SocialInteractionsListener,
) {
  if (typeof window === "undefined") return () => undefined;

  const emitCurrent = () => listener(readSocialInteractions());
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
