import { removeJobApplicationStage } from "./job-application-stages";
import { removeSavedJobGroup } from "./saved-job-groups";
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
  current: "careerfit:saved-job-ids",
  legacy: ["ejik-fit:saved-job-ids"],
} as const;
const CHANGE_EVENT = "careerfit:saved-job-ids-change";

export { MAX_SAVED_JOB_ID_LENGTH, MAX_SAVED_JOB_IDS };

type SavedJobsListener = (ids: string[]) => void;

export function normalizeSavedJobIds(ids: string[]) {
  const recentIds = new Map<string, true>();
  for (const rawId of ids) {
    const id = rawId.trim();
    if (!id || id.length > MAX_SAVED_JOB_ID_LENGTH) continue;
    recentIds.delete(id);
    recentIds.set(id, true);
  }

  return Array.from(recentIds.keys()).slice(-MAX_SAVED_JOB_IDS);
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSavedJobIds(storage = defaultStorage()): string[] {
  if (!storage) return [];
  return readMigratedStorageValue(storage, STORAGE_KEYS, {
    parse(raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
          ? normalizeSavedJobIds(
              parsed.filter((value): value is string => typeof value === "string"),
            )
          : null;
      } catch {
        return null;
      }
    },
    serialize: JSON.stringify,
  }) ?? [];
}

function notifySavedJobsChange(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function writeSavedJobIds(
  ids: string[],
  storage = defaultStorage(),
): string[] {
  const normalized = normalizeSavedJobIds(ids);
  if (!storage) return [];
  const written = writeMigratedStorageValue(storage, STORAGE_KEYS, normalized, {
    parse: () => normalized,
    serialize: JSON.stringify,
  });
  if (!written) {
    return readSavedJobIds(storage);
  }
  notifySavedJobsChange(storage);
  return normalized;
}

export function clearSavedJobs(storage = defaultStorage()): string[] {
  if (!storage) return [];
  clearMigratedStorageValue(storage, STORAGE_KEYS);
  notifySavedJobsChange(storage);
  return [];
}

export function toggleSavedJob(
  id: string,
  storage = defaultStorage(),
): string[] {
  const normalizedId = id.trim();
  const current = readSavedJobIds(storage);
  if (!normalizedId || normalizedId.length > MAX_SAVED_JOB_ID_LENGTH) {
    return current;
  }
  const wasSaved = current.includes(normalizedId);
  const next = writeSavedJobIds(
    wasSaved
      ? current.filter((savedId) => savedId !== normalizedId)
      : [...current, normalizedId],
    storage,
  );
  const toggleSucceeded = wasSaved
    ? !next.includes(normalizedId)
    : next.includes(normalizedId);
  if (toggleSucceeded) {
    removeJobApplicationStage(normalizedId, storage);
    removeSavedJobGroup(normalizedId, storage);
  }
  return next;
}

export function subscribeSavedJobs(listener: SavedJobsListener) {
  if (typeof window === "undefined") return () => undefined;

  const emitCurrent = () => listener(readSavedJobIds());
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
