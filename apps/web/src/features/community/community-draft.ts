import {
  CommunityDataError,
  isCommunityCategory,
  MAX_COMMUNITY_POST_BODY_LENGTH,
  MAX_COMMUNITY_POST_TITLE_LENGTH,
  normalizeCommunityTags,
  normalizeCommunityText,
  type CommunityCategory,
  type CreateCommunityPostInput,
} from "@/lib/community-contract";
import {
  clearMigratedStorageValue,
  readMigratedStorageValue,
  writeMigratedStorageValue,
} from "@/lib/browser-storage-migration";

export const COMMUNITY_DRAFT_STORAGE_KEY = "careerfit:community-draft";
export const LEGACY_COMMUNITY_DRAFT_STORAGE_KEY = "ejik-fit:community-draft";
const COMMUNITY_DRAFT_STORAGE_KEYS = {
  current: COMMUNITY_DRAFT_STORAGE_KEY,
  legacy: [LEGACY_COMMUNITY_DRAFT_STORAGE_KEY],
} as const;

const COMMUNITY_DRAFT_VERSION = 1 as const;
const COMMUNITY_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface CommunityDraft {
  readonly version: typeof COMMUNITY_DRAFT_VERSION;
  readonly category: CommunityCategory;
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly savedAt: string;
}

function normalizeDraft(value: unknown): CommunityDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  const title = normalizeCommunityText(
    candidate.title,
    MAX_COMMUNITY_POST_TITLE_LENGTH,
  );
  const body = normalizeCommunityText(
    candidate.body,
    MAX_COMMUNITY_POST_BODY_LENGTH,
  );
  const tags = normalizeCommunityTags(candidate.tags);
  const savedAt =
    typeof candidate.savedAt === "string" ? candidate.savedAt : null;

  if (
    candidate.version !== COMMUNITY_DRAFT_VERSION ||
    !isCommunityCategory(candidate.category) ||
    !title ||
    !body ||
    !tags ||
    !savedAt ||
    !Number.isFinite(Date.parse(savedAt))
  ) {
    return null;
  }

  return {
    version: COMMUNITY_DRAFT_VERSION,
    category: candidate.category,
    title,
    body,
    tags,
    savedAt: new Date(savedAt).toISOString(),
  };
}

export function saveCommunityDraft(
  input: CreateCommunityPostInput,
  storage: Storage,
  now = new Date(),
): CommunityDraft {
  const draft = normalizeDraft({
    version: COMMUNITY_DRAFT_VERSION,
    category: input.category,
    title: input.title,
    body: input.body,
    tags: input.tags,
    savedAt: now.toISOString(),
  });

  if (!draft) throw new CommunityDataError();
  const written = writeMigratedStorageValue(
    storage,
    COMMUNITY_DRAFT_STORAGE_KEYS,
    draft,
    { parse: normalizeDraft, serialize: JSON.stringify },
  );
  if (!written) throw new CommunityDataError();
  return draft;
}

export function readCommunityDraft(
  storage: Storage,
  now = new Date(),
): CommunityDraft | null {
  const draft = readMigratedStorageValue(storage, COMMUNITY_DRAFT_STORAGE_KEYS, {
    parse(raw) {
      try {
        return normalizeDraft(JSON.parse(raw) as unknown);
      } catch {
        return null;
      }
    },
    serialize: JSON.stringify,
  });
  if (
    !draft ||
    now.getTime() - Date.parse(draft.savedAt) > COMMUNITY_DRAFT_MAX_AGE_MS
  ) {
    removeCommunityDraft(storage);
    return null;
  }

  return draft;
}

export function removeCommunityDraft(storage: Storage): void {
  clearMigratedStorageValue(storage, COMMUNITY_DRAFT_STORAGE_KEYS);
}
