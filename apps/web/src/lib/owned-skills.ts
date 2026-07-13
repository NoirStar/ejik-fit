const KEY = "ejik-fit:owned-skills";
const CHANGE_EVENT = "ejik-fit:owned-skills-change";

export const EMPTY_OWNED_SKILLS: readonly string[] = [];

type SearchParamValue = string | string[] | undefined;
type SearchParamsRecord = Record<string, SearchParamValue>;
type OwnedSkillsListener = (skills: string[]) => void;


export function normalizeOwnedSkills(skills: string[]) {
  return Array.from(
    new Set(skills.map((skill) => skill.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
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
  return normalizeOwnedSkills(splitSearchParam(searchParams?.owned_skills));
}

export function ownedSkillsToDashboardHref(
  skills: string[],
  currentSearch = "",
) {
  const params = new URLSearchParams(currentSearch);
  params.delete("owned_skills");
  normalizeOwnedSkills(skills).forEach((skill) => {
    params.append("owned_skills", skill);
  });
  const query = params.toString();
  return `/${query ? `?${query}` : ""}#my-stack`;
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

export function readOwnedSkills(storage = defaultStorage()): string[] {
  if (!storage) {
    return [];
  }
  const raw = storage.getItem(KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? normalizeOwnedSkills(
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
    storage === window.localStorage
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function writeOwnedSkills(
  skills: string[],
  storage = defaultStorage(),
): string[] {
  const normalized = normalizeOwnedSkills(skills);
  storage?.setItem(KEY, JSON.stringify(normalized));
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
  return writeOwnedSkills(
    readOwnedSkills(storage).filter((item) => item !== skill),
    storage,
  );
}

export function clearOwnedSkills(storage = defaultStorage()): string[] {
  storage?.removeItem(KEY);
  notifyOwnedSkillsChange(storage);
  return [];
}

export function subscribeOwnedSkills(listener: OwnedSkillsListener) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const emitCurrentSkills = () => listener(readOwnedSkills());
  const handleStorage = (event: StorageEvent) => {
    if (
      (event.key === KEY || event.key === null) &&
      (!event.storageArea || event.storageArea === window.localStorage)
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
