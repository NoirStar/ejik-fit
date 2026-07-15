export const MAX_FOLLOWED_COMPANIES = 60;
export const MAX_FOLLOWED_COMPANY_SLUG_LENGTH = 100;

const KEY = "ejik-fit:followed-company-slugs";
const CHANGE_EVENT = "ejik-fit:followed-company-slugs-change";
const COMPANY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type FollowedCompaniesListener = (slugs: string[]) => void;

export function normalizeFollowedCompanySlugs(slugs: string[]) {
  const recentSlugs = new Map<string, true>();
  for (const rawSlug of slugs) {
    const slug = rawSlug.trim().toLocaleLowerCase("en-US");
    if (
      !slug ||
      slug.length > MAX_FOLLOWED_COMPANY_SLUG_LENGTH ||
      !COMPANY_SLUG_PATTERN.test(slug)
    ) {
      continue;
    }
    recentSlugs.delete(slug);
    recentSlugs.set(slug, true);
  }

  return Array.from(recentSlugs.keys()).slice(-MAX_FOLLOWED_COMPANIES);
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readFollowedCompanySlugs(
  storage = defaultStorage(),
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? normalizeFollowedCompanySlugs(
          parsed.filter((value): value is string => typeof value === "string"),
        )
      : [];
  } catch {
    return [];
  }
}

function notifyFollowedCompaniesChange(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function writeFollowedCompanySlugs(
  slugs: string[],
  storage = defaultStorage(),
): string[] {
  const normalized = normalizeFollowedCompanySlugs(slugs);
  if (!storage) return [];
  try {
    storage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    return readFollowedCompanySlugs(storage);
  }
  notifyFollowedCompaniesChange(storage);
  return normalized;
}

export function clearFollowedCompanies(
  storage = defaultStorage(),
): string[] {
  if (!storage) return [];
  try {
    storage.removeItem(KEY);
  } catch {
    return readFollowedCompanySlugs(storage);
  }
  notifyFollowedCompaniesChange(storage);
  return [];
}

export function toggleFollowedCompany(
  slug: string,
  storage = defaultStorage(),
): string[] {
  const normalizedSlug = normalizeFollowedCompanySlugs([slug])[0];
  const current = readFollowedCompanySlugs(storage);
  if (!normalizedSlug) return current;

  return writeFollowedCompanySlugs(
    current.includes(normalizedSlug)
      ? current.filter((followedSlug) => followedSlug !== normalizedSlug)
      : [...current, normalizedSlug],
    storage,
  );
}

export function subscribeFollowedCompanies(
  listener: FollowedCompaniesListener,
) {
  if (typeof window === "undefined") return () => undefined;

  const emitCurrent = () => listener(readFollowedCompanySlugs());
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
