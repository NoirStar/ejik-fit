import { NextResponse } from "next/server";

import { getSkillCatalog } from "@/lib/api";

export async function GET() {
  try {
    const catalog = await getSkillCatalog();
    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "기술명 목록을 불러오지 못했습니다." },
      { status: 502 },
    );
  }
}
