export type RequestPolicy = "public" | "durable" | "private";

type NextRequestInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

export type RequestJsonOptions = Omit<NextRequestInit, "cache" | "next"> & {
  policy: RequestPolicy;
  tags?: string[];
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;

export class ApiError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`API request failed: ${url} (${status})`);
    this.name = "ApiError";
  }
}

export class ApiTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
  ) {
    super(`API request timed out: ${url} (${timeoutMs}ms)`);
    this.name = "ApiTimeoutError";
  }
}

function policyInit(
  policy: RequestPolicy,
  tags: string[],
): Pick<NextRequestInit, "cache" | "next"> {
  if (policy === "private") {
    return { cache: "no-store" };
  }
  return {
    next: {
      revalidate: policy === "durable" ? 300 : 60,
      ...(tags.length > 0 ? { tags } : {}),
    },
  };
}

function combinedSignal(
  callerSignal: AbortSignal | null | undefined,
  timeoutSignal: AbortSignal,
) {
  return callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  {
    policy,
    tags = [],
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
    ...init
  }: RequestJsonOptions,
): Promise<T> {
  const url = new URL(path, baseUrl);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(url, {
      ...policyInit(policy, tags),
      ...init,
      headers: {
        ...(init.headers ?? {}),
      },
      signal: combinedSignal(callerSignal, timeoutSignal),
    });
    if (!response.ok) {
      throw new ApiError(url.toString(), response.status);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (timeoutSignal.aborted && !callerSignal?.aborted) {
      throw new ApiTimeoutError(url.toString(), timeoutMs);
    }
    throw error;
  }
}
