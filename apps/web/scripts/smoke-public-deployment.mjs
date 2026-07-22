import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PUBLIC_SMOKE_CHECKS = [
  { label: "home", path: "/", expectedStatus: 200 },
  { label: "login", path: "/login", expectedStatus: 200 },
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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

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
  return normalizePublicServiceUrl(value, "PUBLIC_SITE_URL");
}

export function normalizePublicServiceUrl(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} is required.`);
  }
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError(`${name} must use HTTP or HTTPS.`);
  }
  if (url.username || url.password) {
    throw new TypeError(`${name} must not contain credentials.`);
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export function classifyCallbackResponse({ location, siteOrigin, status }) {
  if (!REDIRECT_STATUSES.has(status)) {
    return `Expected an authentication callback redirect status, received ${status}.`;
  }
  if (typeof location !== "string" || !location) {
    return "Authentication callback did not provide a redirect location.";
  }
  let target;
  try {
    target = new URL(location, siteOrigin);
  } catch {
    return "Authentication callback redirect location was invalid.";
  }
  if (target.origin !== siteOrigin) {
    return `Authentication callback attempted an off-origin redirect to ${target.origin}.`;
  }
  if (
    target.pathname !== "/login" ||
    target.searchParams.get("error") !== "callback"
  ) {
    return "Authentication callback did not return the invalid-code request to the login error state.";
  }
  return null;
}

export function classifyJsonResponse({
  body,
  contentType,
  expectedOrigin,
  finalUrl,
  status,
  validate,
}) {
  if (status !== 200) return `Expected 200, received ${status}.`;
  let responseOrigin;
  try {
    responseOrigin = new URL(finalUrl).origin;
  } catch {
    return "Response URL was invalid.";
  }
  if (responseOrigin !== expectedOrigin) {
    return `Request redirected away from the expected service to ${responseOrigin}.`;
  }
  if (
    typeof contentType !== "string" ||
    !contentType.toLocaleLowerCase("en-US").includes("application/json")
  ) {
    return "Expected a JSON response.";
  }
  let value;
  try {
    value = JSON.parse(String(body));
  } catch {
    return "Response contained invalid JSON.";
  }
  if (typeof validate !== "function" || !validate(value)) {
    return "Response contained unexpected JSON data.";
  }
  return null;
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

async function fetchSmokeTarget(
  fetchImpl,
  url,
  { accept = "text/html,application/xhtml+xml", headers = {}, redirect = "follow" } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetchImpl(url, {
      cache: "no-store",
      headers: {
        accept,
        "user-agent": "ejik-fit-public-smoke/1.0",
        ...headers,
      },
      redirect,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function runPublicDeploymentSmoke(
  publicSiteUrl,
  {
    fetchImpl = globalThis.fetch,
    log = console.log,
    publicApiUrl,
    publicSupabasePublishableKey,
    publicSupabaseUrl,
  } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A Fetch-compatible implementation is required.");
  }
  const siteUrl = normalizePublicSiteUrl(publicSiteUrl);
  const apiUrl = normalizePublicServiceUrl(publicApiUrl, "PUBLIC_API_URL");
  const supabaseUrl = normalizePublicServiceUrl(
    publicSupabaseUrl,
    "PUBLIC_SUPABASE_URL",
  );
  if (
    typeof publicSupabasePublishableKey !== "string" ||
    !publicSupabasePublishableKey.trim()
  ) {
    throw new TypeError("PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");
  }
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

  const callbackTarget = new URL(
    "/auth/callback?code=public-smoke-invalid-code&next=%2F",
    siteUrl,
  );
  try {
    const response = await fetchSmokeTarget(fetchImpl, callbackTarget, {
      redirect: "manual",
    });
    const failure = classifyCallbackResponse({
      location: response.headers.get("location"),
      siteOrigin: siteUrl.origin,
      status: response.status,
    });
    if (failure) {
      failures.push(`auth callback: ${failure}`);
      log("FAIL auth callback");
    } else {
      log("PASS auth callback safe redirect");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    failures.push(`auth callback: ${message}`);
    log("FAIL auth callback request error");
  }

  const jsonChecks = [
    {
      label: "API health",
      target: new URL("/health", apiUrl),
      expectedOrigin: apiUrl.origin,
      headers: {},
      validate: (value) =>
        value !== null &&
        typeof value === "object" &&
        value.status === "ok" &&
        value.service === "ejik-fit-api",
    },
    {
      label: "public community read",
      target: new URL(
        "/rest/v1/community_posts?select=id%2Ctitle&limit=1",
        supabaseUrl,
      ),
      expectedOrigin: supabaseUrl.origin,
      headers: {
        apikey: publicSupabasePublishableKey.trim(),
        authorization: `Bearer ${publicSupabasePublishableKey.trim()}`,
      },
      validate: Array.isArray,
    },
  ];
  for (const check of jsonChecks) {
    try {
      const response = await fetchSmokeTarget(fetchImpl, check.target, {
        accept: "application/json",
        headers: check.headers,
      });
      const body = (await response.text()).slice(0, 512_000);
      const failure = classifyJsonResponse({
        body,
        contentType: response.headers.get("content-type"),
        expectedOrigin: check.expectedOrigin,
        finalUrl: response.url || check.target.href,
        status: response.status,
        validate: check.validate,
      });
      if (failure) {
        failures.push(`${check.label}: ${failure}`);
        log(`FAIL ${check.label}`);
      } else {
        log(`PASS ${check.label}`);
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
  return {
    checked: PUBLIC_SMOKE_CHECKS.length + 3,
    origin: siteUrl.origin,
  };
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  try {
    const result = await runPublicDeploymentSmoke(process.env.PUBLIC_SITE_URL, {
      publicApiUrl: process.env.PUBLIC_API_URL ?? process.env.API_BASE_URL,
      publicSupabasePublishableKey:
        process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      publicSupabaseUrl:
        process.env.PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    console.log(`Public deployment is reachable: ${result.origin}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
