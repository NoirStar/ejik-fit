export const SKILL_CATEGORIES = [
  { value: "", label: "전체 기술 분야" },
  { value: "language", label: "언어" },
  { value: "frontend", label: "프론트엔드" },
  { value: "backend", label: "백엔드" },
  { value: "infra", label: "인프라" },
  { value: "data", label: "데이터" },
  { value: "ai", label: "AI" },
  { value: "security", label: "보안" },
  { value: "game", label: "게임" },
  { value: "robotics", label: "로보틱스" },
  { value: "mobile", label: "모바일" },
  { value: "design", label: "디자인" },
  { value: "embedded", label: "임베디드" },
  { value: "qa", label: "QA" },
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number]["value"];

const SUPPORTED_SKILL_CATEGORIES = new Set<SkillCategory>(
  SKILL_CATEGORIES.map((category) => category.value),
);

export function normalizeSkillCategory(
  value: string | string[] | undefined,
): SkillCategory {
  const first = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  return SUPPORTED_SKILL_CATEGORIES.has(first as SkillCategory)
    ? (first as SkillCategory)
    : "";
}

export function skillCategoryLabel(category: SkillCategory) {
  return (
    SKILL_CATEGORIES.find((candidate) => candidate.value === category)?.label ??
    "전체 기술 분야"
  );
}
