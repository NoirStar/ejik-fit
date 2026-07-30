import {
  clearMigratedStorageValue,
  isMigratedStorageEventKey,
  readMigratedStorageValue,
  writeMigratedStorageValue,
} from "./browser-storage-migration";

const STORAGE_KEYS = {
  current: "careerfit:career-profile",
  legacy: ["ejik-fit:career-profile"],
} as const;
const CHANGE_EVENT = "careerfit:career-profile-change";

export const CAREER_WORK_TYPES = [
  "development",
  "operations",
  "analysis",
  "automation",
  "planning",
  "leadership",
] as const;
export type CareerWorkType = (typeof CAREER_WORK_TYPES)[number];

export const CAREER_EMPLOYMENT_TYPES = [
  "full_time",
  "contract",
  "freelance",
  "intern",
] as const;
export type CareerEmploymentType = (typeof CAREER_EMPLOYMENT_TYPES)[number];

export const CAREER_LEVELS = [
  "",
  "new_comer",
  "experienced",
  "junior",
  "mid",
  "senior",
  "lead",
] as const;
export type CareerLevel = (typeof CAREER_LEVELS)[number];

export const SKILL_LAST_USED_VALUES = [
  "",
  "current",
  "within_1y",
  "over_1y",
] as const;
export type SkillLastUsed = (typeof SKILL_LAST_USED_VALUES)[number];

export type CareerSkillUsage = {
  years: number | null;
  lastUsed: SkillLastUsed;
};

export type CareerExperienceHighlight = {
  title: string;
  responsibilities: string;
  outcome: string;
  domain: string;
  skills: string[];
};

export type CareerProfile = {
  currentRole: string;
  pastRoles: string[];
  experienceYears: number | null;
  responsibilities: string;
  experienceHighlights: CareerExperienceHighlight[];
  workTypes: CareerWorkType[];
  industryExperience: string[];
  currentDomain: string;
  keepExperience: string;
  interestDomains: string[];
  excludedDomains: string[];
  preferredLocations: string[];
  employmentTypes: CareerEmploymentType[];
  careerLevel: CareerLevel;
  skillUsage: Record<string, CareerSkillUsage>;
};

export const EMPTY_CAREER_PROFILE: CareerProfile = {
  currentRole: "",
  pastRoles: [],
  experienceYears: null,
  responsibilities: "",
  experienceHighlights: [],
  workTypes: [],
  industryExperience: [],
  currentDomain: "",
  keepExperience: "",
  interestDomains: [],
  excludedDomains: [],
  preferredLocations: [],
  employmentTypes: [],
  careerLevel: "",
  skillUsage: {},
};

const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;
const MAX_SHORT_TEXT = 120;
const MAX_LONG_TEXT = 1_200;
const MAX_LIST_ITEMS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stringList(value: unknown, maxItemLength = MAX_SHORT_TEXT) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const normalized = text(item, maxItemLength);
    const key = normalized.toLocaleLowerCase("ko-KR");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length === MAX_LIST_ITEMS) break;
  }
  return result;
}

function domain(value: unknown) {
  const normalized = text(value, 80);
  return DOMAIN_PATTERN.test(normalized) ? normalized : "";
}

function domains(value: unknown) {
  return Array.from(
    new Set(stringList(value, 80).map(domain).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "en"));
}

function experienceYears(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 60
    ? Math.round(value * 10) / 10
    : null;
}

function enumList<T extends string>(value: unknown, allowed: readonly T[]) {
  const valid = new Set(allowed);
  return stringList(value).filter((item): item is T => valid.has(item as T));
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function normalizeSkillUsage(value: unknown) {
  if (!isRecord(value)) return {};
  const result: Record<string, CareerSkillUsage> = {};
  for (const [rawSkill, rawUsage] of Object.entries(value).slice(0, 100)) {
    const skill = text(rawSkill, 100);
    if (!skill || !isRecord(rawUsage)) continue;
    const years = experienceYears(rawUsage.years);
    const lastUsed = enumValue(
      rawUsage.lastUsed,
      SKILL_LAST_USED_VALUES,
      "",
    );
    if (years === null && !lastUsed) continue;
    result[skill] = { years, lastUsed };
  }
  return result;
}

function normalizeExperienceHighlights(value: unknown) {
  if (!Array.isArray(value)) return [];
  const result: CareerExperienceHighlight[] = [];
  for (const item of value.slice(0, 8)) {
    if (!isRecord(item)) continue;
    const highlight = {
      title: text(item.title, MAX_SHORT_TEXT),
      responsibilities: text(item.responsibilities, MAX_LONG_TEXT),
      outcome: text(item.outcome, MAX_LONG_TEXT),
      domain: domain(item.domain),
      skills: stringList(item.skills, 100),
    };
    if (
      !highlight.title &&
      !highlight.responsibilities &&
      !highlight.outcome &&
      !highlight.domain &&
      highlight.skills.length === 0
    ) {
      continue;
    }
    result.push(highlight);
  }
  return result;
}

export function normalizeCareerProfile(value: unknown): CareerProfile {
  if (!isRecord(value)) return { ...EMPTY_CAREER_PROFILE, skillUsage: {} };
  return {
    currentRole: text(value.currentRole, MAX_SHORT_TEXT),
    pastRoles: stringList(value.pastRoles),
    experienceYears: experienceYears(value.experienceYears),
    responsibilities: text(value.responsibilities, MAX_LONG_TEXT),
    experienceHighlights: normalizeExperienceHighlights(
      value.experienceHighlights,
    ),
    workTypes: enumList(value.workTypes, CAREER_WORK_TYPES),
    industryExperience: stringList(value.industryExperience),
    currentDomain: domain(value.currentDomain),
    keepExperience: text(value.keepExperience, MAX_LONG_TEXT),
    interestDomains: domains(value.interestDomains),
    excludedDomains: domains(value.excludedDomains),
    preferredLocations: stringList(value.preferredLocations, 80),
    employmentTypes: enumList(value.employmentTypes, CAREER_EMPLOYMENT_TYPES),
    careerLevel: enumValue(value.careerLevel, CAREER_LEVELS, ""),
    skillUsage: normalizeSkillUsage(value.skillUsage),
  };
}

export function careerAnalysisLevel(profile: CareerProfile) {
  const normalized = normalizeCareerProfile(profile);
  return normalized.currentRole &&
    (normalized.responsibilities || normalized.workTypes.length > 0)
    ? "경력 기준 분석"
    : "기술 기준 분석";
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const codec = {
  parse(raw: string) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? normalizeCareerProfile(parsed) : null;
    } catch {
      return null;
    }
  },
  serialize(value: CareerProfile) {
    return JSON.stringify(normalizeCareerProfile(value));
  },
};

export function readCareerProfile(storage = defaultStorage()): CareerProfile {
  if (!storage) return normalizeCareerProfile(null);
  return readMigratedStorageValue(storage, STORAGE_KEYS, codec) ?? normalizeCareerProfile(null);
}

function notifyCareerProfileChange(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function writeCareerProfile(
  value: CareerProfile,
  storage = defaultStorage(),
) {
  const normalized = normalizeCareerProfile(value);
  if (!storage) return normalizeCareerProfile(null);
  if (!writeMigratedStorageValue(storage, STORAGE_KEYS, normalized, codec)) {
    return readCareerProfile(storage);
  }
  notifyCareerProfileChange(storage);
  return normalized;
}

export function clearCareerProfile(storage = defaultStorage()) {
  if (!storage) return normalizeCareerProfile(null);
  clearMigratedStorageValue(storage, STORAGE_KEYS);
  notifyCareerProfileChange(storage);
  return normalizeCareerProfile(null);
}

export function subscribeCareerProfile(listener: (profile: CareerProfile) => void) {
  if (typeof window === "undefined") return () => undefined;
  const emitCurrent = () => listener(readCareerProfile());
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
