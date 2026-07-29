import { getPostings } from "@/lib/api";
import { normalizeOwnedSkills } from "@/lib/owned-skills";

const CAREER_TYPES = new Set(["new_comer", "experienced", "mixed"]);
const MAX_OWNED_SKILLS = 20;
const MAX_SKILL_LENGTH = 100;

function integerParam(
  params: URLSearchParams,
  name: string,
  fallback: number,
) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const offset = integerParam(params, "offset", 0);
  const limit = integerParam(params, "limit", 20);
  const careerType = params.get("career_type");
  const rawOwnedSkills = params.getAll("owned_skills");
  const ownedSkills = normalizeOwnedSkills(rawOwnedSkills);

  if (
    offset === null ||
    offset < 0 ||
    offset > 10_000 ||
    limit === null ||
    limit < 1 ||
    limit > 20 ||
    (careerType !== null && !CAREER_TYPES.has(careerType)) ||
    rawOwnedSkills.some(
      (skill) => !skill.trim() || skill.length > MAX_SKILL_LENGTH,
    ) ||
    ownedSkills.length > MAX_OWNED_SKILLS
  ) {
    return Response.json(
      { error: "잘못된 피드 요청입니다." },
      { status: 400 },
    );
  }

  const baseFilters = {
    offset,
    limit,
    ...(careerType ? { career_type: careerType } : {}),
  };

  try {
    const postings = await getPostings({
      ...baseFilters,
      ...(ownedSkills.length > 0 ? { owned_skills: ownedSkills } : {}),
    });
    return Response.json(postings, {
      headers: {
        "Cache-Control": ownedSkills.length > 0
          ? "private, no-store"
          : "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    if (ownedSkills.length > 0) {
      try {
        const postings = await getPostings(baseFilters);
        return Response.json(postings, {
          headers: {
            "Cache-Control": "private, no-store",
            "X-Ejik-Personalization": "fallback",
          },
        });
      } catch {
        // Return the same stable service error below.
      }
    }
    return Response.json(
      { error: "공고를 불러오지 못했습니다." },
      { status: 503 },
    );
  }
}
