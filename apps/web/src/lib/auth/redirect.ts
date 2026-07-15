const DEFAULT_AUTH_NEXT_PATH = "/career";

export function safeAuthNextPath(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_AUTH_NEXT_PATH;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return DEFAULT_AUTH_NEXT_PATH;
  }

  if (
    decoded.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(decoded)
  ) {
    return DEFAULT_AUTH_NEXT_PATH;
  }

  try {
    const url = new URL(candidate, "https://ejik.fit");
    if (url.origin !== "https://ejik.fit") return DEFAULT_AUTH_NEXT_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_NEXT_PATH;
  }
}
