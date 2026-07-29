import { skillIdentityKey } from "./skill-catalog";

const KEY = "ejik-fit:owned-skills";
const CHANGE_EVENT = "ejik-fit:owned-skills-change";
export const MAX_OWNED_SKILLS = 20;
export const MAX_OWNED_SKILL_LENGTH = 100;

export const EMPTY_OWNED_SKILLS: readonly string[] = [];

type SearchParamValue = string | string[] | undefined;
type SearchParamsRecord = Record<string, SearchParamValue>;
type OwnedSkillsListener = (skills: string[]) => void;


function uniqueOwnedSkillsInOrder(skills: string[]) {
  const byIdentity = new Map<string, string>();
  for (const skill of skills) {
    const trimmed = skill.trim();
    const identity = skillIdentityKey(trimmed);
    if (identity && !byIdentity.has(identity)) {
      byIdentity.set(identity, trimmed);
    }
  }
  return [...byIdentity.values()];
}

export function normalizeOwnedSkills(skills: string[]) {
  return uniqueOwnedSkillsInOrder(skills).sort((a, b) => a.localeCompare(b));
}

function boundedOwnedSkills(skills: string[]) {
  return uniqueOwnedSkillsInOrder(skills)
    .filter((skill) => skill.length <= MAX_OWNED_SKILL_LENGTH)
    .slice(0, MAX_OWNED_SKILLS)
    .sort((a, b) => a.localeCompare(b));
}

function splitSearchParam(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => item.split(","));
  }
  return value ? value.split(",") : [];
}

export function ownedSkillsFromSearchParams(
  searchParams: SearchParamsRecord | undefined,
): string[] {
  return boundedOwnedSkills(splitSearchParam(searchParams?.owned_skills));
}

export function ownedSkillsToDashboardHref(
  skills: string[],
  currentSearch = "",
) {
  const params = new URLSearchParams(currentSearch);
  params.delete("owned_skills");
  boundedOwnedSkills(skills).forEach((skill) => {
    params.append("owned_skills", skill);
  });
  const query = params.toString();
  return `/${query ? `?${query}` : ""}#my-stack`;
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readOwnedSkills(storage = defaultStorage()): string[] {
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? boundedOwnedSkills(
          parsed.filter((value): value is string => typeof value === "string"),
        )
      : [];
  } catch {
    return [];
  }
}

function notifyOwnedSkillsChange(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function writeOwnedSkills(
  skills: string[],
  storage = defaultStorage(),
): string[] {
  const normalized = boundedOwnedSkills(skills);
  try {
    storage?.setItem(KEY, JSON.stringify(normalized));
  } catch {
    return normalized;
  }
  notifyOwnedSkillsChange(storage);
  return normalized;
}

export function addOwnedSkill(
  skill: string,
  storage = defaultStorage(),
): string[] {
  return writeOwnedSkills([...readOwnedSkills(storage), skill], storage);
}

export function removeOwnedSkill(
  skill: string,
  storage = defaultStorage(),
): string[] {
  const targetKey = skillIdentityKey(skill);
  return writeOwnedSkills(
    readOwnedSkills(storage).filter(
      (item) => skillIdentityKey(item) !== targetKey,
    ),
    storage,
  );
}

export function clearOwnedSkills(storage = defaultStorage()): string[] {
  try {
    storage?.removeItem(KEY);
  } catch {
    return [];
  }
  notifyOwnedSkillsChange(storage);
  return [];
}

export function subscribeOwnedSkills(listener: OwnedSkillsListener) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const emitCurrentSkills = () => listener(readOwnedSkills());
  const handleStorage = (event: StorageEvent) => {
    const browserStorage = defaultStorage();
    if (
      (event.key === KEY || event.key === null) &&
      (!event.storageArea || event.storageArea === browserStorage)
    ) {
      emitCurrentSkills();
    }
  };

  window.addEventListener(CHANGE_EVENT, emitCurrentSkills);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, emitCurrentSkills);
    window.removeEventListener("storage", handleStorage);
  };
}
