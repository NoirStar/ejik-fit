const CACHE_SECONDS = 60 * 60 * 24 * 7;
const MAX_LOGO_BYTES = 2_000_000;

const OFFICIAL_LOGO_URLS: Readonly<Record<string, string>> = {
  "carat-ai":
    "https://opening-attachments.greetinghr.com/2024-07-30/287e8035-1f50-46ae-a75a-3e91d208cee3/app_icon.png",
  daangn: "https://careers.daangn.com/apple-touch-icon.png",
  korbit:
    "https://profiles.greetinghr.com/group/e524bcb4-5dff-4400-bd42-7fb6a1cb7069",
  lambda256:
    "https://profiles.greetinghr.com/group/ca2fcf93-ab3c-41d1-8920-1c76d354fe7c",
  makinarocks:
    "https://profiles.greetinghr.com/group/900e83ac-2ad7-42aa-9f2a-306e88914acf",
  musinsa:
    "https://profiles.greetinghr.com/group/f92732f3-3e8d-4714-93ed-57f672c139b5",
  moloco:
    "https://cdn.prod.website-files.com/6237fca0466ffd9274a1dbdd/6837add3314e91dd48e16dec_Moloco-Webclip.png",
  "nota-ai":
    "https://profiles.greetinghr.com/group/9c58dd87-aaec-4cc8-8a3f-6e93205d0df8",
  portone:
    "https://profiles.greetinghr.com/group/91c1eb78-3ba1-435b-b883-d3c380594976",
  rebellions:
    "https://profiles.greetinghr.com/group/2dd3c0de-aa17-44f2-90cb-0788a948bcff",
  sendbird: "https://sendbird.com/_nuxt/icons/icon_512x512.e709d1.png",
  toss: "https://static.toss.im/tds/favicon/favicon-196x196.png",
  upstage:
    "https://profiles.greetinghr.com/group/b26b9ea2-f544-4f97-b3e6-5ab033440219",
  wrtn:
    "https://opening-attachments.greetinghr.com/2026-02-04/7541c46c-0f18-4a14-9fd9-2f9c4cea4192/logo_full_profile_dark.png",
};

type LogoRouteContext = {
  params: Promise<{ logoKey: string }>;
};

function bytesMatch(bytes: Uint8Array, offset: number, signature: number[]) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function rasterContentType(body: ArrayBuffer) {
  const bytes = new Uint8Array(body);
  if (bytesMatch(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10])) {
    return "image/png";
  }
  if (bytesMatch(bytes, 0, [255, 216, 255])) return "image/jpeg";
  if (
    bytesMatch(bytes, 0, [71, 73, 70, 56, 55, 97]) ||
    bytesMatch(bytes, 0, [71, 73, 70, 56, 57, 97])
  ) {
    return "image/gif";
  }
  if (
    bytesMatch(bytes, 0, [82, 73, 70, 70]) &&
    bytesMatch(bytes, 8, [87, 69, 66, 80])
  ) {
    return "image/webp";
  }
  if (
    bytesMatch(bytes, 4, [102, 116, 121, 112]) &&
    (bytesMatch(bytes, 8, [97, 118, 105, 102]) ||
      bytesMatch(bytes, 8, [97, 118, 105, 115]))
  ) {
    return "image/avif";
  }
  return null;
}

function errorResponse(status: number) {
  return new Response(null, {
    headers: { "Cache-Control": "public, max-age=300" },
    status,
  });
}

export async function GET(_request: Request, context: LogoRouteContext) {
  const { logoKey } = await context.params;
  const upstreamUrl = OFFICIAL_LOGO_URLS[logoKey];
  if (!upstreamUrl) return errorResponse(404);

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
        "User-Agent": "ejik-fit-company-logo/1.0",
      },
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(5_000),
    });
    if (!upstream.ok) return errorResponse(502);

    const declaredSize = Number(upstream.headers.get("Content-Length"));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_LOGO_BYTES) {
      return errorResponse(413);
    }

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_LOGO_BYTES) return errorResponse(413);
    const contentType = rasterContentType(body);
    if (!contentType) return errorResponse(415);

    return new Response(body, {
      headers: {
        "Cache-Control":
          `public, max-age=86400, s-maxage=${CACHE_SECONDS}, ` +
          "stale-while-revalidate=2592000",
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch {
    return errorResponse(502);
  }
}
