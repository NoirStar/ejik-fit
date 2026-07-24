import { NextResponse } from "next/server";

import { ApiError, getSkillGraphEvidence } from "@/lib/api";


const DEFAULT_EVIDENCE_LIMIT = 6;
const MIN_EVIDENCE_LIMIT = 1;
const MAX_EVIDENCE_LIMIT = 20;


function evidenceLimit(value: string | null) {
  if (!value?.trim()) {
    return DEFAULT_EVIDENCE_LIMIT;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_EVIDENCE_LIMIT;
  }
  return Math.max(
    MIN_EVIDENCE_LIMIT,
    Math.min(Math.trunc(parsed), MAX_EVIDENCE_LIMIT),
  );
}


export async function GET(request: Request) {
  const url = new URL(request.url);
  const skill = url.searchParams.get("skill")?.trim();
  if (!skill) {
    return NextResponse.json(
      { error: "기술을 선택해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await getSkillGraphEvidence(
      {
        skill,
        career_type: url.searchParams.get("career_type") ?? undefined,
        limit: evidenceLimit(url.searchParams.get("limit")),
      },
      request.signal,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
