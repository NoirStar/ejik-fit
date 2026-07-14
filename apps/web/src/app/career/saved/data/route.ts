import { NextResponse } from "next/server";

import {
  buildSavedJobItem,
  normalizeSavedJobRequest,
} from "@/features/saved-library/model";
import { ApiError, getPosting } from "@/lib/api";

const INVALID_REQUEST_MESSAGE = "유효한 저장 공고 ID가 필요합니다.";
const LOOKUP_CONCURRENCY = 4;
const GLOBAL_LOOKUP_CONCURRENCY = 8;
const LOOKUP_TIMEOUT_MS = 8_000;
const RATE_LIMIT_MAX_LOOKUPS = 240;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CLIENTS = 512;
const rateLimitByClient = new Map<
  string,
  { lookups: number; resetAt: number }
>();
type LookupWaiter = {
  signal: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (reason: unknown) => void;
  abort: () => void;
};
const lookupWaiters: LookupWaiter[] = [];
let activeLookups = 0;

function forwardedClient(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const client = forwarded?.split(",", 1)[0]?.trim();
  return client ? client.slice(0, 128) : null;
}

function consumeLookupQuota(request: Request, lookupCount: number) {
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
    entry = { lookups: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitByClient.set(client, entry);
  }

  if (entry.lookups + lookupCount > RATE_LIMIT_MAX_LOOKUPS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
    };
  }
  entry.lookups += lookupCount;
  return { allowed: true, retryAfter: 0 };
}

function abortError() {
  return new DOMException("Saved job lookup aborted", "AbortError");
}

function releaseLookupSlot() {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLookups -= 1;
    grantLookupSlots();
  };
}

function grantLookupSlots() {
  while (
    activeLookups < GLOBAL_LOOKUP_CONCURRENCY &&
    lookupWaiters.length > 0
  ) {
    const waiter = lookupWaiters.shift();
    if (!waiter) return;
    waiter.signal.removeEventListener("abort", waiter.abort);
    if (waiter.signal.aborted) {
      waiter.reject(abortError());
      continue;
    }
    activeLookups += 1;
    waiter.resolve(releaseLookupSlot());
  }
}

function acquireLookupSlot(signal: AbortSignal): Promise<() => void> {
  if (signal.aborted) return Promise.reject(abortError());
  if (activeLookups < GLOBAL_LOOKUP_CONCURRENCY) {
    activeLookups += 1;
    return Promise.resolve(releaseLookupSlot());
  }

  return new Promise((resolve, reject) => {
    const waiter: LookupWaiter = {
      signal,
      resolve,
      reject,
      abort: () => {
        const index = lookupWaiters.indexOf(waiter);
        if (index >= 0) lookupWaiters.splice(index, 1);
        reject(abortError());
      },
    };
    signal.addEventListener("abort", waiter.abort, { once: true });
    lookupWaiters.push(waiter);
  });
}

async function getPostingWithinGlobalLimit(id: string, signal: AbortSignal) {
  const release = await acquireLookupSlot(signal);
  try {
    return await getPosting(id, signal);
  } finally {
    release();
  }
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
    const quota = consumeLookupQuota(request, ids.length);
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
      getPostingWithinGlobalLimit(id, lookup.signal),
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
