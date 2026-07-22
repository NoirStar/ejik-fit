import { describe, expect, it } from "vitest";

import {
  classifyPublicResponse,
  normalizePublicSiteUrl,
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
});
