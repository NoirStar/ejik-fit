const KEY = "ejik-fit:career-preferences";
const CHANGE_EVENT = "ejik-fit:career-preferences-change";
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
  try {
    const raw = storage.getItem(KEY);
    return raw
      ? normalizeCareerPreferences(JSON.parse(raw) as unknown)
      : { ...EMPTY_CAREER_PREFERENCES };
  } catch {
    return { ...EMPTY_CAREER_PREFERENCES };
  }
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
  try {
    storage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    return readCareerPreferences(storage);
  }
  notifyCareerPreferencesChange(storage);
  return normalized;
}

export function clearCareerPreferences(
  storage = defaultStorage(),
): CareerPreferences {
  if (!storage) return { ...EMPTY_CAREER_PREFERENCES };
  try {
    storage.removeItem(KEY);
  } catch {
    return readCareerPreferences(storage);
  }
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
