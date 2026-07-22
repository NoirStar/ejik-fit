import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PUBLIC_SMOKE_CHECKS = [
  { label: "home", path: "/", expectedStatus: 200 },
  { label: "privacy", path: "/privacy", expectedStatus: 200 },
  {
    label: "search",
    path: "/search?q=react",
    expectedStatus: 200,
  },
  {
    label: "missing post",
    path: "/posts/smoke-missing-post",
    expectedStatus: 404,
  },
];

const DEPLOYMENT_NOT_FOUND_PATTERNS = [
  "deployment_not_found",
  "deployment not found",
  "the deployment could not be found",
];
const DEPLOYMENT_PROTECTION_PATTERNS = [
  "authentication required",
  "vercel authentication",
  "this deployment is protected",
  "_vercel_sso_nonce",
];

export function normalizePublicSiteUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("PUBLIC_SITE_URL is required.");
  }
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError("PUBLIC_SITE_URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new TypeError("PUBLIC_SITE_URL must not contain credentials.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export function classifyPublicResponse({
  body,
  contentType,
  expectedStatus,
  finalUrl,
  siteOrigin,
  status,
}) {
  const normalizedBody = String(body).toLocaleLowerCase("en-US");
  if (
    DEPLOYMENT_NOT_FOUND_PATTERNS.some((pattern) =>
      normalizedBody.includes(pattern),
    )
  ) {
    return "Vercel deployment not found response detected.";
  }
  if (
    DEPLOYMENT_PROTECTION_PATTERNS.some((pattern) =>
      normalizedBody.includes(pattern),
    )
  ) {
    return "Vercel deployment protection page detected.";
  }

  let responseOrigin;
  try {
    responseOrigin = new URL(finalUrl).origin;
  } catch {
    return "Response URL was invalid.";
  }
  if (responseOrigin !== siteOrigin) {
    return `Request redirected away from the public site to ${responseOrigin}.`;
  }
  const streamedSafeNotFound =
    expectedStatus === 404 &&
    status === 200 &&
    String(body).includes("페이지를 찾을 수 없습니다.");
  if (status !== expectedStatus && !streamedSafeNotFound) {
    return `Expected ${expectedStatus}, received ${status}.`;
  }
  if (
    typeof contentType !== "string" ||
    !contentType.toLocaleLowerCase("en-US").includes("text/html") ||
    !/<(?:!doctype|html)\b/i.test(String(body))
  ) {
    return "Expected an HTML response.";
  }
  return null;
}

async function fetchSmokeTarget(fetchImpl, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetchImpl(url, {
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "ejik-fit-public-smoke/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function runPublicDeploymentSmoke(
  publicSiteUrl,
  { fetchImpl = globalThis.fetch, log = console.log } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A Fetch-compatible implementation is required.");
  }
  const siteUrl = normalizePublicSiteUrl(publicSiteUrl);
  const failures = [];

  for (const check of PUBLIC_SMOKE_CHECKS) {
    const target = new URL(check.path, siteUrl);
    try {
      const response = await fetchSmokeTarget(fetchImpl, target);
      const body = (await response.text()).slice(0, 512_000);
      const failure = classifyPublicResponse({
        body,
        contentType: response.headers.get("content-type"),
        expectedStatus: check.expectedStatus,
        finalUrl: response.url || target.href,
        siteOrigin: siteUrl.origin,
        status: response.status,
      });
      if (failure) {
        failures.push(`${check.label}: ${failure}`);
        log(`FAIL ${check.label} ${target.pathname}${target.search}`);
      } else {
        log(
          `PASS ${check.label} ${
            check.expectedStatus === 404 ? "safe 404" : response.status
          }`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "request failed";
      failures.push(`${check.label}: ${message}`);
      log(`FAIL ${check.label} request error`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Public deployment smoke failed:\n${failures
        .map((failure) => `- ${failure}`)
        .join("\n")}`,
    );
  }
  return { checked: PUBLIC_SMOKE_CHECKS.length, origin: siteUrl.origin };
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  try {
    const result = await runPublicDeploymentSmoke(process.env.PUBLIC_SITE_URL);
    console.log(`Public deployment is reachable: ${result.origin}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
