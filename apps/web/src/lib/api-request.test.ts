import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiTimeoutError, requestJson } from "./api-request";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

describe("requestJson", () => {
  it.each([
    ["public", { next: { revalidate: 60, tags: ["postings"] } }],
    ["durable", { next: { revalidate: 300, tags: ["catalog"] } }],
    ["private", { cache: "no-store" }],
  ] as const)("applies the %s request policy", async (policy, expected) => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await requestJson("https://api.example", "/resource", {
      policy,
      tags:
        policy === "public"
          ? ["postings"]
          : policy === "durable"
            ? ["catalog"]
            : [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/resource", "https://api.example"),
      expect.objectContaining(expected),
    );
  });

  it("classifies a timeout separately from an HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
      ),
    );

    await expect(
      requestJson("https://api.example", "/slow", {
        policy: "public",
        timeoutMs: 5,
      }),
    ).rejects.toBeInstanceOf(ApiTimeoutError);
  });

  it("keeps a caller cancellation distinct from a timeout", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
      ),
    );
    const request = requestJson("https://api.example", "/cancelled", {
      policy: "public",
      signal: controller.signal,
    });
    controller.abort(new DOMException("cancelled", "AbortError"));

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
