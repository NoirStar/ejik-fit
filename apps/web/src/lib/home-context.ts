import {
  normalizeCareerPreferences,
  type CareerPreferences,
} from "./career-preferences";
import {
  ownedSkillsFromSearchParams,
} from "./owned-skills";

type SearchParamValue = string | string[] | undefined;
type SearchParamsRecord = Record<string, SearchParamValue>;

type UrlSearchParamsReader = Pick<
  URLSearchParams,
  "get" | "getAll" | "has"
>;

export type HomeContext = {
  ownedSkills: string[];
  careerPreferences: CareerPreferences;
};

function first(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function homeContextFromSearchParams(
  searchParams: SearchParamsRecord | undefined,
): HomeContext {
  return {
    ownedSkills: ownedSkillsFromSearchParams(searchParams),
    careerPreferences: normalizeCareerPreferences({
      careerCondition: first(searchParams?.career_type),
      targetDomain: first(searchParams?.target_domain),
    }),
  };
}

export function homeContextFromUrlSearchParams(
  searchParams: UrlSearchParamsReader,
): HomeContext {
  return {
    ownedSkills: ownedSkillsFromSearchParams({
      owned_skills: searchParams.getAll("owned_skills"),
    }),
    careerPreferences: normalizeCareerPreferences({
      careerCondition: searchParams.get("career_type"),
      targetDomain: searchParams.get("target_domain"),
    }),
  };
}

export function hasHomeCareerPreferenceParams(
  searchParams: UrlSearchParamsReader,
) {
  return (
    searchParams.has("career_type") || searchParams.has("target_domain")
  );
}

export function homeContextToDashboardHref(
  context: HomeContext,
  currentSearch = "",
  hash = "my-stack",
) {
  const params = new URLSearchParams(currentSearch);
  params.delete("owned_skills");
  params.delete("career_type");
  params.delete("target_domain");

  for (const skill of ownedSkillsFromSearchParams({
    owned_skills: context.ownedSkills,
  })) {
    params.append("owned_skills", skill);
  }
  const preferences = normalizeCareerPreferences(context.careerPreferences);
  if (preferences.careerCondition) {
    params.set("career_type", preferences.careerCondition);
  }
  if (preferences.targetDomain) {
    params.set("target_domain", preferences.targetDomain);
  }

  const query = params.toString();
  return `/${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}
