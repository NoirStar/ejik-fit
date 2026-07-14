const KEY = "ejik-fit:saved-job-ids";
const CHANGE_EVENT = "ejik-fit:saved-job-ids-change";

export const MAX_SAVED_JOB_IDS = 24;
export const MAX_SAVED_JOB_ID_LENGTH = 200;

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
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? normalizeSavedJobIds(
          parsed.filter((value): value is string => typeof value === "string"),
        )
      : [];
  } catch {
    return [];
  }
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
  try {
    storage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    return readSavedJobIds(storage);
  }
  notifySavedJobsChange(storage);
  return normalized;
}

export function clearSavedJobs(storage = defaultStorage()): string[] {
  if (!storage) return [];
  try {
    storage.removeItem(KEY);
  } catch {
    return readSavedJobIds(storage);
  }
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
  return writeSavedJobIds(
    current.includes(normalizedId)
      ? current.filter((savedId) => savedId !== normalizedId)
      : [...current, normalizedId],
    storage,
  );
}

export function subscribeSavedJobs(listener: SavedJobsListener) {
  if (typeof window === "undefined") return () => undefined;

  const emitCurrent = () => listener(readSavedJobIds());
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
