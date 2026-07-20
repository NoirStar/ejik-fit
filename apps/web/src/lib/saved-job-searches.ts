import {
  normalizeSkillCategory,
  skillCategoryLabel,
  type SkillCategory,
} from "./skill-categories";

export const MAX_SAVED_JOB_SEARCHES = 10;
export const MAX_SAVED_JOB_SEARCH_NAME_LENGTH = 60;
export const MAX_SAVED_JOB_SEARCH_QUERY_LENGTH = 200;

export type SavedJobSearchCareerType =
  | ""
  | "new_comer"
  | "experienced"
  | "mixed";

export type SavedJobSearchFilters = {
  query: string;
  category: SkillCategory;
  careerType: SavedJobSearchCareerType;
};

export type SavedJobSearch = SavedJobSearchFilters & {
  id: string;
  userId: string;
  name: string;
  filterKey: string;
  enabled: boolean;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedJobSearchRow = {
  id: unknown;
  user_id: unknown;
  name: unknown;
  query_text: unknown;
  query_key: unknown;
  category: unknown;
  career_type: unknown;
  is_enabled: unknown;
  last_checked_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

const CAREER_TYPES = new Set<SavedJobSearchCareerType>([
  "",
  "new_comer",
  "experienced",
  "mixed",
]);

const CAREER_LABELS: Record<Exclude<SavedJobSearchCareerType, "">, string> = {
  new_comer: "신입",
  experienced: "경력",
  mixed: "신입·경력",
};

function normalizeQuery(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_SAVED_JOB_SEARCH_QUERY_LENGTH)
    .trimEnd();
}

function normalizeCareerType(value: unknown): SavedJobSearchCareerType {
  return typeof value === "string" &&
    CAREER_TYPES.has(value as SavedJobSearchCareerType)
    ? (value as SavedJobSearchCareerType)
    : "";
}

export function normalizeSavedJobSearchFilters(
  value: unknown,
): SavedJobSearchFilters {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const category =
    typeof candidate.category === "string" ? candidate.category : undefined;

  return {
    query: normalizeQuery(candidate.query),
    category: normalizeSkillCategory(category),
    careerType: normalizeCareerType(candidate.careerType),
  };
}

export function hasSavedJobSearchFilter(filters: SavedJobSearchFilters) {
  const normalized = normalizeSavedJobSearchFilters(filters);
  return Boolean(
    normalized.query || normalized.category || normalized.careerType,
  );
}

export function savedJobSearchQueryKey(filters: SavedJobSearchFilters) {
  return normalizeQuery(filters.query).toLowerCase();
}

export function savedJobSearchFilterKey(filters: SavedJobSearchFilters) {
  const normalized = normalizeSavedJobSearchFilters(filters);
  return [
    savedJobSearchQueryKey(normalized),
    normalized.category,
    normalized.careerType,
  ].join("|");
}

export function defaultSavedJobSearchName(filters: SavedJobSearchFilters) {
  const parts = [
    filters.query,
    filters.category ? skillCategoryLabel(filters.category) : "",
    filters.careerType ? CAREER_LABELS[filters.careerType] : "",
  ].filter(Boolean);
  return parts.join(" · ").slice(0, MAX_SAVED_JOB_SEARCH_NAME_LENGTH);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isDateString(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export function savedJobSearchFromRow(
  row: SavedJobSearchRow,
): SavedJobSearch | null {
  if (
    !isNonEmptyString(row.id) ||
    !isNonEmptyString(row.user_id) ||
    !isNonEmptyString(row.name) ||
    row.name.length > MAX_SAVED_JOB_SEARCH_NAME_LENGTH ||
    typeof row.query_text !== "string" ||
    typeof row.query_key !== "string" ||
    typeof row.category !== "string" ||
    typeof row.career_type !== "string" ||
    typeof row.is_enabled !== "boolean" ||
    !isDateString(row.last_checked_at) ||
    !isDateString(row.created_at) ||
    !isDateString(row.updated_at)
  ) {
    return null;
  }

  const filters = normalizeSavedJobSearchFilters({
    query: row.query_text,
    category: row.category,
    careerType: row.career_type,
  });

  if (
    filters.query !== row.query_text ||
    savedJobSearchQueryKey(filters) !== row.query_key ||
    filters.category !== row.category ||
    filters.careerType !== row.career_type ||
    !hasSavedJobSearchFilter(filters)
  ) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    ...filters,
    filterKey: savedJobSearchFilterKey(filters),
    enabled: row.is_enabled,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
