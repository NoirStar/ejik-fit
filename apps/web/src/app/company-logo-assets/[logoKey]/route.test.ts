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

  it("proxies the official Nexon Games careers logo", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
        headers: { "Content-Type": "image/png" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/company-logo-assets/nexon-games"),
      { params: Promise.resolve({ logoKey: "nexon-games" }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://careers.nexon.com/files/logo/company-logo-nexon-games.png",
      expect.any(Object),
    );
  });

  it("uses a fresh key for the official Nexon Korea wordmark", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/company-logo-assets/nexon-korea"),
      { params: Promise.resolve({ logoKey: "nexon-korea" }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://careers.nexon.com/files/logo/company-logo-nexon.png",
      expect.any(Object),
    );
  });

  it("proxies the icon declared by the official Kakao careers page", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([0, 0, 1, 0, 1, 0, 64, 64]), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/company-logo-assets/kakao"),
      { params: Promise.resolve({ logoKey: "kakao" }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://t1.daumcdn.net/comis/common/images/favicon_64x64.ico",
      expect.any(Object),
    );
  });

  it.each([
    {
      body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      key: "coinone",
      upstreamUrl:
        "https://image.ninehire.com/brand/b2baa5f0-1f40-11f0-8c6c-596fcda513ba/f2e49d60-2414-11f0-8c6c-596fcda513ba.png",
    },
    {
      body: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      ),
      key: "ahnlab",
      upstreamUrl:
        "https://cloudimg.ccs.ahnlab.com/img_upload/assets/images/ko/logo-ahnlab-black2.svg",
    },
  ])("proxies the official $key company mark", async ({ body, key, upstreamUrl }) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(body, {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(`http://localhost/company-logo-assets/${key}`),
      { params: Promise.resolve({ logoKey: key }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(upstreamUrl, expect.any(Object));
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
