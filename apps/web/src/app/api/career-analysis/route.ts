import { analyzeCareer, ApiError } from "@/lib/api";
import type { CareerAnalyzeRequest } from "@/lib/types";

const MAX_BODY_BYTES = 64_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validRequest(value: unknown): value is CareerAnalyzeRequest {
  if (!isObject(value) || !isObject(value.profile)) return false;
  if (!Array.isArray(value.owned_skills)) return false;
  if (!value.owned_skills.every((skill) => typeof skill === "string")) return false;
  return (
    typeof value.limit === "number" &&
    Number.isInteger(value.limit) &&
    value.limit >= 1 &&
    value.limit <= 100 &&
    typeof value.offset === "number" &&
    Number.isInteger(value.offset) &&
    value.offset >= 0 &&
    value.offset <= 100_000
  );
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "프로필 요청이 너무 큽니다." }, { status: 413 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "잘못된 분석 요청입니다." }, { status: 400 });
  }
  if (!validRequest(input) || JSON.stringify(input).length > MAX_BODY_BYTES) {
    return Response.json({ error: "잘못된 분석 요청입니다." }, { status: 400 });
  }

  try {
    return Response.json(await analyzeCareer(input), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      return Response.json({ error: "분석 조건을 확인해 주세요." }, { status: 400 });
    }
    return Response.json(
      { error: "커리어 분석을 불러오지 못했습니다." },
      { status: 503 },
    );
  }
}
