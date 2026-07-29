import type { SkillCatalogItem, SkillCatalogResponse } from "./types";

export function skillNameKey(value: string) {
  return value.trim().split(/\s+/).join(" ").toLocaleLowerCase("en-US");
}

export const SKILL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "C#": ["csharp", "씨샵"],
  "C++": ["cpp", "씨플플"],
  JavaScript: ["js", "자바스크립트"],
  Kubernetes: ["k8s", "쿠버네티스"],
  "Node.js": ["node", "nodejs", "노드"],
  PostgreSQL: ["postgres", "포스트그레스"],
  React: ["reactjs", "리액트"],
  Spring: ["스프링"],
  TypeScript: ["ts", "타입스크립트"],
};

const ALIAS_TARGETS = new Map(
  Object.entries(SKILL_ALIASES).flatMap(([canonicalName, aliases]) =>
    aliases.map((alias) => [skillNameKey(alias), canonicalName] as const),
  ),
);

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
    !candidate.domains.every((domain) => typeof domain === "string") ||
    (candidate.aliases !== undefined &&
      (!Array.isArray(candidate.aliases) ||
        !candidate.aliases.every((alias) => typeof alias === "string")))
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
    ...(candidate.aliases === undefined
      ? {}
      : {
          aliases: candidate.aliases
            .map((alias) => alias.trim())
            .filter(Boolean),
        }),
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
  const catalogMatch = catalog.find(
    (item) =>
      skillNameKey(item.name) === key ||
      (item.aliases ?? []).some((alias) => skillNameKey(alias) === key),
  );
  if (catalogMatch) {
    return catalogMatch.name;
  }

  return (
    catalog.find((skill) => skillNameKey(skill.name) === key)?.name ?? trimmed
  );
}

export function resolveSkillInput(
  value: string,
  catalog: readonly SkillCatalogItem[],
) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const key = skillNameKey(trimmed);
  const catalogMatch = catalog.find(
    (item) =>
      skillNameKey(item.name) === key ||
      (item.aliases ?? []).some((alias) => skillNameKey(alias) === key),
  );
  if (catalogMatch) {
    return catalogMatch.name;
  }

  const aliasTarget = ALIAS_TARGETS.get(key);
  if (aliasTarget) {
    return (
      catalog.find(
        (item) => skillNameKey(item.name) === skillNameKey(aliasTarget),
      )?.name ?? aliasTarget
    );
  }

  return canonicalSkillName(trimmed, catalog);
}

export function resolvedSkillKey(
  value: string,
  catalog: readonly SkillCatalogItem[],
) {
  return skillNameKey(resolveSkillInput(value, catalog));
}

export function skillIdentityKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return skillNameKey(ALIAS_TARGETS.get(skillNameKey(trimmed)) ?? trimmed);
}
