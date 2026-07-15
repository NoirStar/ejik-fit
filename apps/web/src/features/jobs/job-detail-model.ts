import type { SkillDetail } from "@/lib/types";

export type JobSkillGroups = {
  required: SkillDetail[];
  preferred: SkillDetail[];
  unspecified: SkillDetail[];
};

export type JobDescriptionBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

export function groupJobSkills(skills: SkillDetail[]): JobSkillGroups {
  return {
    required: skills.filter(
      (skill) => skill.requirement_type === "required",
    ),
    preferred: skills.filter(
      (skill) => skill.requirement_type === "preferred",
    ),
    unspecified: skills.filter(
      (skill) => skill.requirement_type === "unspecified",
    ),
  };
}

function skillKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function matchOwnedJobSkills(
  skills: SkillDetail[],
  ownedSkills: string[],
): string[] {
  const owned = new Set(ownedSkills.map(skillKey).filter(Boolean));
  const matched = new Map<string, string>();

  for (const detail of skills) {
    const key = skillKey(detail.skill);
    if (key && owned.has(key) && !matched.has(key)) {
      matched.set(key, detail.skill.trim());
    }
  }

  return Array.from(matched.values()).sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizedDescriptionLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+(?=#{2,4}\s+)/g, "\n")
    .replace(/[ \t]+(?=[*•◦-]\s+)/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parsePostingDescription(
  text: string,
): JobDescriptionBlock[] {
  const blocks: JobDescriptionBlock[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ kind: "list", items: listItems });
      listItems = [];
    }
  };

  for (const line of normalizedDescriptionLines(text)) {
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length === 2 ? 2 : 3,
        text: heading[2].trim(),
      });
      continue;
    }

    const bullet = line.match(/^[*•◦-]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1].trim());
      continue;
    }

    flushList();
    blocks.push({ kind: "paragraph", text: line });
  }

  flushList();
  return blocks;
}
