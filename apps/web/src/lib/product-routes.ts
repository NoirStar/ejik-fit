export type ProductRouteParams = Record<
  string,
  string | string[] | undefined
>;

export function buildSkillGraphHref(params: ProductRouteParams): string {
  const output = new URLSearchParams();
  const skill = Array.isArray(params.skill) ? params.skill[0] : params.skill;

  if (skill) {
    output.set("seed", skill);
  }

  for (const [key, value] of Object.entries(params)) {
    if (key === "skill" || value === undefined) continue;

    for (const item of Array.isArray(value) ? value : [value]) {
      if (item) output.append(key, item);
    }
  }

  const query = output.toString();
  return `/skills/graph${query ? `?${query}` : ""}`;
}
