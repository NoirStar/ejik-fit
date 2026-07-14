import { NextResponse } from "next/server";

import {
  buildSavedJobItem,
  normalizeSavedJobRequest,
} from "@/features/saved-library/model";
import { ApiError, getPosting } from "@/lib/api";

const INVALID_REQUEST_MESSAGE = "유효한 저장 공고 ID가 필요합니다.";

export async function POST(request: Request) {
  let ids: string[];
  try {
    ids = normalizeSavedJobRequest(await request.json());
  } catch {
    return NextResponse.json(
      { error: INVALID_REQUEST_MESSAGE },
      { status: 400 },
    );
  }

  const results = await Promise.allSettled(ids.map((id) => getPosting(id)));
  const items = [];
  const unavailableIds: string[] = [];
  const failedIds: string[] = [];

  for (const [index, result] of results.entries()) {
    const id = ids[index];
    if (result.status === "fulfilled") {
      items.push(buildSavedJobItem(result.value));
    } else if (result.reason instanceof ApiError && result.reason.status === 404) {
      unavailableIds.push(id);
    } else {
      failedIds.push(id);
    }
  }

  return NextResponse.json(
    {
      items,
      unavailable_ids: unavailableIds,
      failed_ids: failedIds,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
