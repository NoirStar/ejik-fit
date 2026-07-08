const KEY = "ejik-fit:owned-skills";

export const DEFAULT_OWNED_SKILLS = [
  "Java",
  "Spring",
  "AWS",
  "Docker",
  "Kubernetes",
];

type SearchParamValue = string | string[] | undefined;
type SearchParamsRecord = Record<string, SearchParamValue>;


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


export function ownedSkillsToDashboardHref(skills: string[]) {
  const params = new URLSearchParams();
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
      ? normalizeOwnedSkills(parsed.filter((value): value is string => typeof value === "string"))
      : [];
  } catch {
    return [];
  }
}


export function writeOwnedSkills(
  skills: string[],
  storage = defaultStorage(),
): string[] {
  const normalized = normalizeOwnedSkills(skills);
  storage?.setItem(KEY, JSON.stringify(normalized));
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
