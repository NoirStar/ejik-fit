import { permanentRedirect } from "next/navigation";

type LegacySkillMapPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacySkillMapPage({
  searchParams,
}: LegacySkillMapPageProps) {
  const resolved = (await searchParams) ?? {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) query.append(key, item);
    }
  }
  const serialized = query.toString();
  permanentRedirect("/career-map" + (serialized ? "?" + serialized : ""));
}
