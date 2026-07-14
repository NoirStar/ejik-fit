import { NextResponse } from "next/server";

import {
  buildSavedJobItem,
  normalizeSavedJobRequest,
} from "@/features/saved-library/model";
import { ApiError, getPosting } from "@/lib/api";

const INVALID_REQUEST_MESSAGE = "유효한 저장 공고 ID가 필요합니다.";
const LOOKUP_CONCURRENCY = 4;
const LOOKUP_TIMEOUT_MS = 8_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CLIENTS = 512;
const rateLimitByClient = new Map<
  string,
  { count: number; resetAt: number }
>();

function forwardedClient(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const client = forwarded?.split(",", 1)[0]?.trim();
  return client ? client.slice(0, 128) : null;
}

function consumeLookupQuota(request: Request) {
  const client = forwardedClient(request);
  if (!client) return { allowed: true, retryAfter: 0 };

  const now = Date.now();
  let entry = rateLimitByClient.get(client);
  if (!entry || entry.resetAt <= now) {
    if (rateLimitByClient.size >= RATE_LIMIT_MAX_CLIENTS) {
      for (const [key, candidate] of rateLimitByClient) {
        if (candidate.resetAt <= now) rateLimitByClient.delete(key);
      }
      if (rateLimitByClient.size >= RATE_LIMIT_MAX_CLIENTS) {
        const oldestClient = rateLimitByClient.keys().next().value;
        if (oldestClient) rateLimitByClient.delete(oldestClient);
      }
    }
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitByClient.set(client, entry);
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
    };
  }
  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

async function settleWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = {
          status: "fulfilled",
          value: await task(items[index]),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    ),
  );
  return results;
}

function lookupSignal(parentSignal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (parentSignal.aborted) abort();
  else parentSignal.addEventListener("abort", abort, { once: true });

  const timeout = setTimeout(abort, LOOKUP_TIMEOUT_MS);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      parentSignal.removeEventListener("abort", abort);
    },
  };
}

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

  if (ids.length > 0) {
    const quota = consumeLookupQuota(request);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error:
            "저장 공고 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(quota.retryAfter),
          },
        },
      );
    }
  }

  const lookup = lookupSignal(request.signal);
  let results: Array<PromiseSettledResult<Awaited<ReturnType<typeof getPosting>>>>;
  try {
    results = await settleWithConcurrency(ids, LOOKUP_CONCURRENCY, (id) =>
      getPosting(id, lookup.signal),
    );
  } finally {
    lookup.dispose();
  }
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
