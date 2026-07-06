const KEY = "ejik-fit:owned-skills";


function normalize(skills: string[]) {
  return Array.from(
    new Set(skills.map((skill) => skill.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
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
      ? normalize(parsed.filter((value): value is string => typeof value === "string"))
      : [];
  } catch {
    return [];
  }
}


export function writeOwnedSkills(
  skills: string[],
  storage = defaultStorage(),
): string[] {
  const normalized = normalize(skills);
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
