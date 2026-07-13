import { validatedHttpUrl } from "./safe-url";
import type {
  PostingDetail,
  PostingListResponse,
  PostingSummary,
  SkillDetail,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  record: Record<string, unknown>,
  key: string,
  allowEmpty = false,
) {
  const value = record[key];
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.trim().length === 0)
  ) {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return value;
}

function dateField(record: Record<string, unknown>, key: string) {
  const value = stringField(record, key);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return value;
}

function nullableString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return value;
}

function nullableDate(record: Record<string, unknown>, key: string) {
  const value = nullableString(record, key);
  if (value !== null && Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return value;
}

function nullableYear(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return Number(value);
}

function strings(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return value;
}

export function normalizePostingSummary(value: unknown): PostingSummary {
  if (!isRecord(value)) throw new Error("Invalid posting item");

  return {
    id: stringField(value, "id"),
    title: stringField(value, "title"),
    company_name: stringField(value, "company_name"),
    career_type: nullableString(value, "career_type"),
    employment_type: nullableString(value, "employment_type"),
    career_min: nullableYear(value, "career_min"),
    career_max: nullableYear(value, "career_max"),
    location: nullableString(value, "location"),
    status: stringField(value, "status"),
    source_url: validatedHttpUrl(value.source_url, "source_url"),
    last_verified_at: dateField(value, "last_verified_at"),
    opens_at: nullableDate(value, "opens_at"),
    closes_at: nullableDate(value, "closes_at"),
    required_skills: strings(value, "required_skills"),
    preferred_skills: strings(value, "preferred_skills"),
    unspecified_skills: strings(value, "unspecified_skills"),
  };
}

export function normalizePostingList(value: unknown): PostingListResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Invalid posting list response");
  }
  if (!Number.isSafeInteger(value.total) || Number(value.total) < 0) {
    throw new Error("Invalid posting total");
  }
  return {
    items: value.items.map(normalizePostingSummary),
    total: Number(value.total),
  };
}

function normalizeSkillDetail(value: unknown): SkillDetail {
  if (!isRecord(value)) throw new Error("Invalid posting skill detail");
  const requirement = stringField(value, "requirement_type");
  if (!(["required", "preferred", "unspecified"] as const).includes(
    requirement as SkillDetail["requirement_type"],
  )) {
    throw new Error("Invalid posting field: requirement_type");
  }
  const confidence = value.confidence;
  if (
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error("Invalid posting field: confidence");
  }

  return {
    skill: stringField(value, "skill"),
    category: stringField(value, "category"),
    requirement_type: requirement as SkillDetail["requirement_type"],
    evidence_text: nullableString(value, "evidence_text"),
    confidence,
    match_reason: stringField(value, "match_reason"),
  };
}

export function normalizePostingDetail(value: unknown): PostingDetail {
  if (!isRecord(value)) throw new Error("Invalid posting detail");
  const summary = normalizePostingSummary(value);
  const detailValue = value.skill_details;
  if (detailValue !== undefined && !Array.isArray(detailValue)) {
    throw new Error("Invalid posting field: skill_details");
  }

  return {
    ...summary,
    description_html: stringField(value, "description_html", true),
    description_text: stringField(value, "description_text", true),
    opens_at: summary.opens_at ?? null,
    closes_at: summary.closes_at ?? null,
    skills: strings(value, "skills"),
    ...(Array.isArray(detailValue)
      ? { skill_details: detailValue.map(normalizeSkillDetail) }
      : {}),
  };
}
