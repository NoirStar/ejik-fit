import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("company logo asset proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects an unknown logo key without making a network request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/company-logo-assets/unknown"), {
      params: Promise.resolve({ logoKey: "unknown" }),
    });

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies a whitelisted official raster logo with shared caching", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
        headers: { "Content-Type": "multipart/form-data" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/company-logo-assets/upstage"), {
      params: Promise.resolve({ logoKey: "upstage" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=604800");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses a transparent browser-compatible user agent for official sites that reject bare bot agents", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await GET(new Request("http://localhost/company-logo-assets/krafton"), {
      params: Promise.resolve({ logoKey: "krafton" }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringMatching(/^Mozilla\/5\.0 .*EjikFitLogoProxy/),
        }),
      }),
    );
  });

  it("accepts a whitelisted Windows icon by its file signature", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([0, 0, 1, 0, 1, 0, 32, 32]), {
        headers: { "Content-Type": "application/octet-stream" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/company-logo-assets/smilegate"),
      { params: Promise.resolve({ logoKey: "smilegate" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/x-icon");
  });

  it("serves a safe official SVG with a restrictive content policy", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>',
        { headers: { "Content-Type": "text/plain" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/company-logo-assets/sap-korea-mark"),
      { params: Promise.resolve({ logoKey: "sap-korea-mark" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "default-src 'none'",
    );
  });

  it("rejects an SVG containing executable content", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        { headers: { "Content-Type": "image/svg+xml" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/company-logo-assets/sap-korea-mark"),
      { params: Promise.resolve({ logoKey: "sap-korea-mark" }) },
    );

    expect(response.status).toBe(415);
  });
});
