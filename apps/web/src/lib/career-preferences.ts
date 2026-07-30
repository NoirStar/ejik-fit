import {
  clearMigratedStorageValue,
  isMigratedStorageEventKey,
  readMigratedStorageValue,
  writeMigratedStorageValue,
} from "./browser-storage-migration";

const STORAGE_KEYS = {
  current: "careerfit:career-preferences",
  legacy: ["ejik-fit:career-preferences"],
} as const;
const CHANGE_EVENT = "careerfit:career-preferences-change";
const MAX_DOMAIN_ID_LENGTH = 80;

export type CareerCondition = "" | "new_comer" | "experienced" | "mixed";

export type CareerPreferences = {
  careerCondition: CareerCondition;
  targetDomain: string;
};

type CareerPreferencesListener = (preferences: CareerPreferences) => void;

export const EMPTY_CAREER_PREFERENCES: CareerPreferences = {
  careerCondition: "",
  targetDomain: "",
};

const VALID_CAREER_CONDITIONS = new Set<CareerCondition>([
  "",
  "new_comer",
  "experienced",
  "mixed",
]);

function normalizeCareerCondition(value: unknown): CareerCondition {
  return typeof value === "string" &&
    VALID_CAREER_CONDITIONS.has(value as CareerCondition)
    ? (value as CareerCondition)
    : "";
}

function normalizeDomainId(value: unknown) {
  if (typeof value !== "string") return "";
  const domain = value.trim();
  return domain.length <= MAX_DOMAIN_ID_LENGTH &&
    /^[a-z0-9][a-z0-9_-]*$/i.test(domain)
    ? domain
    : "";
}

export function normalizeCareerPreferences(
  value: unknown,
): CareerPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_CAREER_PREFERENCES };
  }
  const candidate = value as Partial<Record<keyof CareerPreferences, unknown>>;
  return {
    careerCondition: normalizeCareerCondition(candidate.careerCondition),
    targetDomain: normalizeDomainId(candidate.targetDomain),
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

export function readCareerPreferences(
  storage = defaultStorage(),
): CareerPreferences {
  if (!storage) return { ...EMPTY_CAREER_PREFERENCES };
  return readMigratedStorageValue(storage, STORAGE_KEYS, {
    parse(raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? normalizeCareerPreferences(parsed)
          : null;
      } catch {
        return null;
      }
    },
    serialize: JSON.stringify,
  }) ?? { ...EMPTY_CAREER_PREFERENCES };
}

function notifyCareerPreferencesChange(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function writeCareerPreferences(
  value: CareerPreferences,
  storage = defaultStorage(),
): CareerPreferences {
  const normalized = normalizeCareerPreferences(value);
  if (!storage) return { ...EMPTY_CAREER_PREFERENCES };
  const written = writeMigratedStorageValue(storage, STORAGE_KEYS, normalized, {
    parse: () => normalized,
    serialize: JSON.stringify,
  });
  if (!written) {
    return readCareerPreferences(storage);
  }
  notifyCareerPreferencesChange(storage);
  return normalized;
}

export function clearCareerPreferences(
  storage = defaultStorage(),
): CareerPreferences {
  if (!storage) return { ...EMPTY_CAREER_PREFERENCES };
  clearMigratedStorageValue(storage, STORAGE_KEYS);
  notifyCareerPreferencesChange(storage);
  return { ...EMPTY_CAREER_PREFERENCES };
}

export function subscribeCareerPreferences(
  listener: CareerPreferencesListener,
) {
  if (typeof window === "undefined") return () => undefined;

  const emitCurrent = () => listener(readCareerPreferences());
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
