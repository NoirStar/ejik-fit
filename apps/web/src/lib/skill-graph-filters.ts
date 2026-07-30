export type SkillGraphDomainSelection = readonly string[];

function normalizeSkillGraphDomains(
  selection: SkillGraphDomainSelection,
  availableDomains: readonly string[],
) {
  const available = new Set(availableDomains);
  return [...new Set(selection)].filter((domain) => available.has(domain));
}

export function toggleSkillGraphDomain(
  selection: SkillGraphDomainSelection,
  domain: string,
  availableDomains: readonly string[],
) {
  const current = normalizeSkillGraphDomains(selection, availableDomains);
  if (!availableDomains.includes(domain)) return current;

  if (current.includes(domain)) {
    return current.filter((item) => item !== domain);
  }

  return [...current, domain];
}

export function resolveSkillGraphEnabledDomains(
  selection: SkillGraphDomainSelection,
  availableDomains: readonly string[],
) {
  const current = normalizeSkillGraphDomains(selection, availableDomains);
  return current.length > 0 ? current : undefined;
}

export function skillGraphDomainSummary(
  selection: SkillGraphDomainSelection,
) {
  if (selection.length === 0) return "전체";
  return `${selection.length}개`;
}
