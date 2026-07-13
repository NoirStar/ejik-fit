import { NextResponse } from "next/server";

import { analyzeFit, ApiError } from "@/lib/api";
import type { FitAnalyzeRequest } from "@/lib/types";


export async function POST(request: Request) {
  let payload: FitAnalyzeRequest;
  try {
    payload = (await request.json()) as FitAnalyzeRequest;
  } catch {
    return NextResponse.json(
      { error: "유효한 JSON 요청이 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeFit(payload, request.signal);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
