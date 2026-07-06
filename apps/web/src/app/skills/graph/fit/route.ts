import { NextResponse } from "next/server";

import { analyzeFit, ApiError } from "@/lib/api";
import type { FitAnalyzeRequest } from "@/lib/types";


export async function POST(request: Request) {
  const payload = (await request.json()) as FitAnalyzeRequest;
  try {
    const result = await analyzeFit(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
