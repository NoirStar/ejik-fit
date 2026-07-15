const KEY = "ejik-fit:recent-community-topics";
const CHANGE_EVENT = "ejik-fit:recent-community-topics-change";

export const MAX_RECENT_COMMUNITY_TOPICS = 8;
const MAX_POST_ID_LENGTH = 140;
const MAX_TITLE_LENGTH = 120;
const MAX_TOPIC_LABEL_LENGTH = 40;
const SAFE_POST_ID = /^[a-z0-9][a-z0-9-]*$/i;

export type RecentCommunityTopic = {
  postId: string;
  title: string;
  topicLabel: string;
  source: "mock" | "local";
  viewedAt: string;
};

export type RecentCommunityTopicDraft = Omit<
  RecentCommunityTopic,
  "viewedAt"
>;

type RecordRecentCommunityTopicOptions = {
  storage?: Storage | null;
  viewedAt?: string;
};

type RecentCommunityTopicListener = (topics: RecentCommunityTopic[]) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePostId(value: unknown) {
  if (typeof value !== "string") return null;
  const postId = value.trim();
  return postId.length <= MAX_POST_ID_LENGTH && SAFE_POST_ID.test(postId)
    ? postId
    : null;
}

function normalizeTopic(value: unknown): RecentCommunityTopic | null {
  if (!isRecord(value)) return null;
  const postId = normalizePostId(value.postId);
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const topicLabel =
    typeof value.topicLabel === "string" ? value.topicLabel.trim() : "";
  const viewedAt = typeof value.viewedAt === "string" ? value.viewedAt.trim() : "";
  if (
    !postId ||
    !title ||
    title.length > MAX_TITLE_LENGTH ||
    !topicLabel ||
    topicLabel.length > MAX_TOPIC_LABEL_LENGTH ||
    (value.source !== "mock" && value.source !== "local") ||
    !viewedAt ||
    Number.isNaN(Date.parse(viewedAt))
  ) {
    return null;
  }
  return {
    postId,
    title,
    topicLabel,
    source: value.source,
    viewedAt: new Date(viewedAt).toISOString(),
  };
}

export function normalizeRecentCommunityTopics(
  value: unknown,
): RecentCommunityTopic[] {
  if (!Array.isArray(value)) return [];
  const candidates = value
    .map((candidate, index) => ({ index, topic: normalizeTopic(candidate) }))
    .filter(
      (candidate): candidate is { index: number; topic: RecentCommunityTopic } =>
        candidate.topic !== null,
    )
    .sort(
      (left, right) =>
        Date.parse(right.topic.viewedAt) - Date.parse(left.topic.viewedAt) ||
        left.index - right.index,
    );
  const topics: RecentCommunityTopic[] = [];
  const seen = new Set<string>();
  for (const { topic } of candidates) {
    if (seen.has(topic.postId)) continue;
    topics.push(topic);
    seen.add(topic.postId);
    if (topics.length === MAX_RECENT_COMMUNITY_TOPICS) break;
  }
  return topics;
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRecentCommunityTopics(
  storage = defaultStorage(),
): RecentCommunityTopic[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    return raw ? normalizeRecentCommunityTopics(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
}

function notifyRecentCommunityTopics(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function writeRecentCommunityTopics(
  value: RecentCommunityTopic[],
  storage = defaultStorage(),
) {
  const normalized = normalizeRecentCommunityTopics(value);
  if (!storage) return [];
  try {
    storage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    return readRecentCommunityTopics(storage);
  }
  notifyRecentCommunityTopics(storage);
  return normalized;
}

export function recordRecentCommunityTopic(
  draft: RecentCommunityTopicDraft,
  options: RecordRecentCommunityTopicOptions = {},
): RecentCommunityTopic[] {
  const storage =
    options.storage === undefined ? defaultStorage() : options.storage;
  const current = readRecentCommunityTopics(storage);
  const candidate = normalizeTopic({
    ...draft,
    viewedAt: options.viewedAt ?? new Date().toISOString(),
  });
  if (!candidate) return current;
  return writeRecentCommunityTopics(
    [candidate, ...current.filter((topic) => topic.postId !== candidate.postId)],
    storage,
  );
}

export function removeRecentCommunityTopic(
  postId: string,
  storage = defaultStorage(),
): RecentCommunityTopic[] {
  const current = readRecentCommunityTopics(storage);
  const normalizedPostId = normalizePostId(postId);
  if (!normalizedPostId || !current.some((topic) => topic.postId === normalizedPostId)) {
    return current;
  }
  return writeRecentCommunityTopics(
    current.filter((topic) => topic.postId !== normalizedPostId),
    storage,
  );
}

export function clearRecentCommunityTopics(
  storage = defaultStorage(),
): RecentCommunityTopic[] {
  if (!storage) return [];
  try {
    storage.removeItem(KEY);
  } catch {
    return readRecentCommunityTopics(storage);
  }
  notifyRecentCommunityTopics(storage);
  return [];
}

export function subscribeRecentCommunityTopics(
  listener: RecentCommunityTopicListener,
) {
  if (typeof window === "undefined") return () => undefined;

  const emitCurrent = () => listener(readRecentCommunityTopics());
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
