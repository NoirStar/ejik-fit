import { NextResponse } from "next/server";

import { analyzeFit } from "@/lib/api";
import type { FitAnalyzeRequest } from "@/lib/types";


export async function POST(request: Request) {
  const payload = (await request.json()) as FitAnalyzeRequest;
  const result = await analyzeFit(payload);
  return NextResponse.json(result);
}
