import { NextResponse } from "next/server";

import { ApiError, getSkillTrends } from "@/lib/api";


export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const skills = Array.from(
    new Set(
      params
        .getAll("skills")
        .map((skill) => skill.trim())
        .filter(Boolean),
    ),
  );
  if (skills.length > 3 || skills.some((skill) => skill.length > 100)) {
    return NextResponse.json(
      { error: "기술은 최대 3개까지 비교할 수 있습니다." },
      { status: 422 },
    );
  }

  try {
    const trend = await getSkillTrends(skills, 12);
    return NextResponse.json(trend, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: "기술 추세 데이터를 불러오지 못했습니다." },
        { status: error.status },
      );
    }
    throw error;
  }
}
