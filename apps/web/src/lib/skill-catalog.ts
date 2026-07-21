import type { SkillCatalogItem, SkillCatalogResponse } from "./types";

export function skillNameKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function parseCatalogItem(value: unknown): SkillCatalogItem {
  if (!value || typeof value !== "object") {
    throw new Error("invalid skill catalog item");
  }
  const candidate = value as Partial<SkillCatalogItem>;
  if (
    typeof candidate.name !== "string" ||
    typeof candidate.category !== "string" ||
    typeof candidate.kind !== "string" ||
    !Array.isArray(candidate.domains) ||
    !candidate.domains.every((domain) => typeof domain === "string")
  ) {
    throw new Error("invalid skill catalog item");
  }

  const name = candidate.name.trim();
  if (!name || !candidate.category || !candidate.kind) {
    throw new Error("invalid skill catalog item");
  }
  return {
    name,
    category: candidate.category,
    kind: candidate.kind,
    domains: [...candidate.domains],
  };
}

export function parseSkillCatalogResponse(value: unknown): SkillCatalogResponse {
  if (!value || typeof value !== "object") {
    throw new Error("invalid skill catalog response");
  }
  const candidate = value as { items?: unknown; total?: unknown };
  if (
    !Array.isArray(candidate.items) ||
    typeof candidate.total !== "number" ||
    !Number.isSafeInteger(candidate.total) ||
    candidate.total < 0
  ) {
    throw new Error("invalid skill catalog response");
  }

  const items = candidate.items.map(parseCatalogItem);
  if (
    candidate.total !== items.length ||
    new Set(items.map((item) => skillNameKey(item.name))).size !== items.length
  ) {
    throw new Error("invalid skill catalog response");
  }
  return { items, total: candidate.total };
}

export function canonicalSkillName(
  value: string,
  catalog: readonly SkillCatalogItem[],
) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const key = skillNameKey(trimmed);
  return (
    catalog.find((skill) => skillNameKey(skill.name) === key)?.name ?? trimmed
  );
}
