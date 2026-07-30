import {
  clearMigratedStorageValue,
  isMigratedStorageEventKey,
  readMigratedStorageValue,
  writeMigratedStorageValue,
} from "./browser-storage-migration";
import {
  MAX_SAVED_JOB_ID_LENGTH,
  MAX_SAVED_JOB_IDS,
} from "./saved-job-contract";

const STORAGE_KEYS = {
  current: "careerfit:saved-job-groups",
  legacy: ["ejik-fit:saved-job-groups"],
} as const;
const CHANGE_EVENT = "careerfit:saved-job-groups-change";

export const SAVED_JOB_GROUPS = [
  { value: "", label: "분류하지 않음" },
  { value: "current", label: "현재 경력 유지" },
  { value: "adjacent", label: "인접 커리어" },
  { value: "interest", label: "관심 분야" },
  { value: "comparing", label: "비교 중" },
] as const;

export type SavedJobGroupValue = (typeof SAVED_JOB_GROUPS)[number]["value"];
export type SavedJobGroup = Exclude<SavedJobGroupValue, "">;
export type SavedJobGroups = Record<string, SavedJobGroup>;

type SavedJobGroupsListener = (groups: SavedJobGroups) => void;

const VALID_GROUPS = new Set<SavedJobGroup>(
  SAVED_JOB_GROUPS.flatMap((group) => (group.value ? [group.value] : [])),
);

function isSavedJobGroup(value: unknown): value is SavedJobGroup {
  return typeof value === "string" && VALID_GROUPS.has(value as SavedJobGroup);
}

export function savedJobGroupLabel(value: SavedJobGroupValue) {
  return (
    SAVED_JOB_GROUPS.find((group) => group.value === value)?.label ??
    "분류하지 않음"
  );
}

export function normalizeSavedJobGroups(value: unknown): SavedJobGroups {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const groups = new Map<string, SavedJobGroup>();
  for (const [rawId, rawGroup] of Object.entries(value)) {
    const id = rawId.trim();
    if (
      !id ||
      id.length > MAX_SAVED_JOB_ID_LENGTH ||
      !isSavedJobGroup(rawGroup)
    ) {
      continue;
    }
    groups.delete(id);
    groups.set(id, rawGroup);
  }

  return Object.fromEntries(
    [...groups.entries()].slice(-MAX_SAVED_JOB_IDS),
  );
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSavedJobGroups(
  storage = defaultStorage(),
): SavedJobGroups {
  if (!storage) return {};
  return (
    readMigratedStorageValue(storage, STORAGE_KEYS, {
      parse(raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? normalizeSavedJobGroups(parsed)
            : null;
        } catch {
          return null;
        }
      },
      serialize: JSON.stringify,
    }) ?? {}
  );
}

function notifySavedJobGroupsChange(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function writeSavedJobGroups(
  groups: unknown,
  storage = defaultStorage(),
): SavedJobGroups {
  const normalized = normalizeSavedJobGroups(groups);
  if (!storage) return {};
  const written = writeMigratedStorageValue(storage, STORAGE_KEYS, normalized, {
    parse: () => normalized,
    serialize: JSON.stringify,
  });
  if (!written) return readSavedJobGroups(storage);
  notifySavedJobGroupsChange(storage);
  return normalized;
}

export function setSavedJobGroup(
  rawId: string,
  group: SavedJobGroupValue,
  storage = defaultStorage(),
): SavedJobGroups {
  const id = rawId.trim();
  const current = readSavedJobGroups(storage);
  if (!id || id.length > MAX_SAVED_JOB_ID_LENGTH) return current;

  const next: SavedJobGroups = { ...current };
  delete next[id];
  if (group && isSavedJobGroup(group)) next[id] = group;
  return writeSavedJobGroups(next, storage);
}

export function removeSavedJobGroup(
  id: string,
  storage = defaultStorage(),
) {
  return setSavedJobGroup(id, "", storage);
}

export function clearSavedJobGroups(
  storage = defaultStorage(),
): SavedJobGroups {
  if (!storage) return {};
  clearMigratedStorageValue(storage, STORAGE_KEYS);
  notifySavedJobGroupsChange(storage);
  return {};
}

export function subscribeSavedJobGroups(listener: SavedJobGroupsListener) {
  if (typeof window === "undefined") return () => undefined;

  const emitCurrent = () => listener(readSavedJobGroups());
  const handleStorage = (event: StorageEvent) => {
    const browserStorage = defaultStorage();
    if (
      isMigratedStorageEventKey(event.key, STORAGE_KEYS) &&
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
