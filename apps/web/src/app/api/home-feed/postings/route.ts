import { getPostings } from "@/lib/api";

const CAREER_TYPES = new Set(["new_comer", "experienced", "mixed"]);

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

  if (
    offset === null ||
    offset < 0 ||
    offset > 10_000 ||
    limit === null ||
    limit < 1 ||
    limit > 20 ||
    (careerType !== null && !CAREER_TYPES.has(careerType))
  ) {
    return Response.json(
      { error: "잘못된 피드 요청입니다." },
      { status: 400 },
    );
  }

  try {
    const postings = await getPostings({
      offset,
      limit,
      ...(careerType ? { career_type: careerType } : {}),
    });
    return Response.json(postings, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json(
      { error: "공고를 불러오지 못했습니다." },
      { status: 503 },
    );
  }
}
