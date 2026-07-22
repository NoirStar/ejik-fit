import { describe, expect, it } from "vitest";

import {
  classifyCallbackResponse,
  classifyJsonResponse,
  classifyPublicResponse,
  normalizePublicServiceUrl,
  normalizePublicSiteUrl,
  PUBLIC_SMOKE_CHECKS,
} from "./smoke-public-deployment.mjs";

const baseResponse = {
  body: "<!doctype html><html><head><title>이직핏</title></head></html>",
  contentType: "text/html; charset=utf-8",
  expectedStatus: 200,
  finalUrl: "https://ejik.fit/",
  siteOrigin: "https://ejik.fit",
  status: 200,
};

describe("public deployment smoke classification", () => {
  it("includes the public login screen in the HTML checks", () => {
    expect(PUBLIC_SMOKE_CHECKS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "login", path: "/login" }),
      ]),
    );
  });

  it("accepts public HTML and the expected safe 404", () => {
    expect(classifyPublicResponse(baseResponse)).toBeNull();
    expect(
      classifyPublicResponse({
        ...baseResponse,
        expectedStatus: 404,
        finalUrl: "https://ejik.fit/posts/smoke-missing-post",
        status: 404,
      }),
    ).toBeNull();
    expect(
      classifyPublicResponse({
        ...baseResponse,
        body: "<!doctype html><html>페이지를 찾을 수 없습니다.</html>",
        expectedStatus: 404,
        finalUrl: "https://ejik.fit/posts/smoke-missing-post",
        status: 200,
      }),
    ).toBeNull();
  });

  it("rejects deployment errors and authentication protection pages", () => {
    expect(
      classifyPublicResponse({
        ...baseResponse,
        body: "DEPLOYMENT_NOT_FOUND",
        expectedStatus: 404,
        status: 404,
      }),
    ).toMatch(/deployment not found/i);
    expect(
      classifyPublicResponse({
        ...baseResponse,
        body: "<html><title>Authentication Required</title></html>",
        status: 401,
      }),
    ).toMatch(/deployment protection/i);
  });

  it("rejects unexpected status, non-HTML, and off-origin redirects", () => {
    expect(
      classifyPublicResponse({ ...baseResponse, status: 500 }),
    ).toMatch(/expected 200, received 500/i);
    expect(
      classifyPublicResponse({
        ...baseResponse,
        body: "{}",
        contentType: "application/json",
      }),
    ).toMatch(/expected an html response/i);
    expect(
      classifyPublicResponse({
        ...baseResponse,
        finalUrl: "https://vercel.com/login",
      }),
    ).toMatch(/redirected away/i);
  });

  it("normalizes only credential-free HTTP(S) site URLs", () => {
    expect(normalizePublicSiteUrl(" https://ejik.fit/path ").href).toBe(
      "https://ejik.fit/",
    );
    for (const value of [
      "",
      "ftp://ejik.fit",
      "https://user:secret@ejik.fit",
      "not a url",
    ]) {
      expect(() => normalizePublicSiteUrl(value)).toThrow();
    }
  });

  it("accepts only a same-origin callback redirect to the login error state", () => {
    expect(
      classifyCallbackResponse({
        location: "/login?error=callback&mode=signin&next=%2F",
        siteOrigin: "https://ejik.fit",
        status: 307,
      }),
    ).toBeNull();
    expect(
      classifyCallbackResponse({
        location: "https://evil.example/login?error=callback",
        siteOrigin: "https://ejik.fit",
        status: 307,
      }),
    ).toMatch(/off-origin/i);
    expect(
      classifyCallbackResponse({
        location: "/",
        siteOrigin: "https://ejik.fit",
        status: 200,
      }),
    ).toMatch(/redirect status/i);
  });

  it("validates API health and a public Supabase collection response", () => {
    expect(
      classifyJsonResponse({
        body: '{"status":"ok","service":"ejik-fit-api"}',
        contentType: "application/json",
        expectedOrigin: "https://api.ejik.fit",
        finalUrl: "https://api.ejik.fit/health",
        status: 200,
        validate: (value) =>
          value?.status === "ok" && value?.service === "ejik-fit-api",
      }),
    ).toBeNull();
    expect(
      classifyJsonResponse({
        body: "[]",
        contentType: "application/json; charset=utf-8",
        expectedOrigin: "https://example.supabase.co",
        finalUrl:
          "https://example.supabase.co/rest/v1/community_posts?select=id&limit=1",
        status: 200,
        validate: Array.isArray,
      }),
    ).toBeNull();
    expect(
      classifyJsonResponse({
        body: '{"status":"degraded"}',
        contentType: "application/json",
        expectedOrigin: "https://api.ejik.fit",
        finalUrl: "https://api.ejik.fit/health",
        status: 200,
        validate: (value) => value?.status === "ok",
      }),
    ).toMatch(/unexpected json/i);
  });

  it("normalizes credential-free API and Supabase base URLs", () => {
    expect(
      normalizePublicServiceUrl("https://api.ejik.fit/v1", "PUBLIC_API_URL")
        .href,
    ).toBe("https://api.ejik.fit/");
    expect(() =>
      normalizePublicServiceUrl("https://user:secret@api.ejik.fit", "API"),
    ).toThrow(/credentials/i);
  });
});
