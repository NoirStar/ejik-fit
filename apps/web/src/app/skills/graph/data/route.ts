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


export async function GET(request: Request) {
  const url = new URL(request.url);
  const owned = url.searchParams.getAll("owned_skills");
  try {
    const result = await getSkillGraph({
      seed: url.searchParams.get("seed") ?? undefined,
      owned_skills: owned,
      career_type: url.searchParams.get("career_type") ?? undefined,
      limit: graphLimit(url.searchParams.get("limit")),
      include_evidence: false,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
