import { NextResponse } from "next/server";

import { ApiError, getSkillGraph } from "@/lib/api";


const DEFAULT_GRAPH_LIMIT = 30;
const MIN_GRAPH_LIMIT = 5;
const MAX_GRAPH_LIMIT = 60;


function graphLimit(value: string | null): number {
  if (!value?.trim()) {
    return DEFAULT_GRAPH_LIMIT;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_GRAPH_LIMIT;
  }
  return Math.max(MIN_GRAPH_LIMIT, Math.min(Math.trunc(parsed), MAX_GRAPH_LIMIT));
}

function graphDepth(value: string | null): 1 | 2 | null {
  if (value === null || value === "1") return 1;
  if (value === "2") return 2;
  return null;
}


export async function GET(request: Request) {
  const url = new URL(request.url);
  const depth = graphDepth(url.searchParams.get("depth"));
  if (depth === null) {
    return NextResponse.json(
      { error: "지원하지 않는 그래프 깊이입니다." },
      { status: 400 },
    );
  }
  try {
    const result = await getSkillGraph({
      seed: url.searchParams.get("seed") ?? undefined,
      career_type: url.searchParams.get("career_type") ?? undefined,
      depth,
      limit: graphLimit(url.searchParams.get("limit")),
      include_evidence: false,
    });
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
