import { normalizePostingSummary } from "./posting-contract";
import type {
  HiringCompanyActivity,
  HiringOverviewResponse,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid hiring overview field: ${key}`);
  }
  return value;
}

function dateTime(record: Record<string, unknown>, key: string) {
  const value = text(record, key);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid hiring overview field: ${key}`);
  }
  return value;
}

function nullableDateTime(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid hiring overview field: ${key}`);
  }
  return value;
}

function dateOnly(record: Record<string, unknown>, key: string) {
  const value = text(record, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid hiring overview field: ${key}`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid hiring overview field: ${key}`);
  }
  return value;
}

function count(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`Invalid hiring overview field: ${key}`);
  }
  return Number(value);
}

function normalizeActivity(value: unknown): HiringCompanyActivity {
  if (!isRecord(value)) {
    throw new Error("Invalid hiring company activity");
  }
  const companySlug = text(value, "company_slug");
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(companySlug)) {
    throw new Error("Invalid hiring overview field: company_slug");
  }
  return {
    company_name: text(value, "company_name"),
    company_slug: companySlug,
    new_postings: count(value, "new_postings"),
    latest_first_seen_at: dateTime(value, "latest_first_seen_at"),
    nearest_deadline_at: nullableDateTime(value, "nearest_deadline_at"),
  };
}

export function normalizeHiringOverview(
  value: unknown,
): HiringOverviewResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.deadlines) ||
    !Array.isArray(value.activities)
  ) {
    throw new Error("Invalid hiring overview response");
  }
  const rangeStart = dateOnly(value, "range_start");
  const rangeEnd = dateOnly(value, "range_end");
  if (rangeEnd <= rangeStart) {
    throw new Error("Invalid hiring overview range");
  }
  return {
    range_start: rangeStart,
    range_end: rangeEnd,
    activity_since: dateTime(value, "activity_since"),
    deadline_total: count(value, "deadline_total"),
    closing_next_7_days: count(value, "closing_next_7_days"),
    undated_open_postings: count(value, "undated_open_postings"),
    activity_company_total: count(value, "activity_company_total"),
    deadlines: value.deadlines.map(normalizePostingSummary),
    activities: value.activities.map(normalizeActivity),
  };
}
