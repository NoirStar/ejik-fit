import { NextResponse } from "next/server";

import { getSkillGraph } from "@/lib/api";


export async function GET(request: Request) {
  const url = new URL(request.url);
  const owned = url.searchParams.getAll("owned_skills");
  const result = await getSkillGraph({
    seed: url.searchParams.get("seed") ?? undefined,
    owned_skills: owned,
    career_type: url.searchParams.get("career_type") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? "30"),
  });
  return NextResponse.json(result);
}
