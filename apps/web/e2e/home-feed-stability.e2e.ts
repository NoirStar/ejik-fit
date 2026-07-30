import { expect, test } from "@playwright/test";

import {
  COMMUNITY_FIXTURE_ORIGIN,
  COMMUNITY_TEST_EMAIL,
  COMMUNITY_TEST_PASSWORD,
  resetCommunityFixture,
  seedFollowingFixture,
} from "./fixtures/community-auth";

const communityTitle = "첫 화면부터 보이는 커뮤니티 글";
const communityTags = ["SSR", "피드", "안정성", "모바일"];

test.afterEach(async ({ request }) => {
  await resetCommunityFixture(request);
});

test("renders community posts before hydration without mixing in home jobs", async ({
  page,
  request,
}) => {
  await resetCommunityFixture(request);
  const authResponse = await request.post(
    `${COMMUNITY_FIXTURE_ORIGIN}/auth/v1/token?grant_type=password`,
    {
      data: {
        email: COMMUNITY_TEST_EMAIL,
        password: COMMUNITY_TEST_PASSWORD,
      },
    },
  );
  expect(authResponse.ok()).toBe(true);
  const fixtureSession = (await authResponse.json()) as {
    access_token: string;
    user: { id: string };
  };
  const postResponse = await request.post(
    `${COMMUNITY_FIXTURE_ORIGIN}/rest/v1/community_posts`,
    {
      data: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        author_id: fixtureSession.user.id,
        category: "커리어 질문",
        title: communityTitle,
        body: "브라우저가 실행되기 전 HTML에도 이 글이 포함되어야 합니다.",
        tags: communityTags,
      },
      headers: { authorization: `Bearer ${fixtureSession.access_token}` },
    },
  );
  expect(postResponse.status()).toBe(201);

  const serverResponse = await request.get("http://127.0.0.1:3102/community");
  expect(serverResponse.ok()).toBe(true);
  const serverHtml = await serverResponse.text();
  const communityPosition = serverHtml.indexOf(communityTitle);
  const jobPosition = serverHtml.indexOf("Python Backend Engineer");
  expect(communityPosition).toBeGreaterThanOrEqual(0);
  expect(jobPosition).toBe(-1);

  const browserCommunityReads: string[] = [];
  page.on("request", (browserRequest) => {
    const requestUrl = new URL(browserRequest.url());
    if (
      browserRequest.method() === "GET" &&
      requestUrl.pathname === "/rest/v1/community_posts"
    ) {
      browserCommunityReads.push(browserRequest.url());
    }
  });

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/community", { waitUntil: "domcontentloaded" });

  const feedPanel = page.getByRole("tabpanel");
  const communityArticle = feedPanel.getByRole("article", {
    name: communityTitle,
  });
  await expect(feedPanel.locator("article").first()).toHaveAccessibleName(
    communityTitle,
  );
  await expect(communityArticle).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Python Backend Engineer" }),
  ).toHaveCount(0);
  const tagList = communityArticle.getByRole("list", {
    name: `${communityTitle} 태그`,
  });
  await expect(tagList.getByRole("link")).toHaveCount(communityTags.length);
  await expect(communityArticle.getByText("+1", { exact: true })).toHaveCount(0);

  await page.waitForTimeout(750);
  await expect(feedPanel.locator("article").first()).toHaveAccessibleName(
    communityTitle,
  );
  expect(browserCommunityReads).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});

test("continues the community feed when the user reaches its end", async ({
  page,
  request,
}) => {
  await resetCommunityFixture(request);
  await seedFollowingFixture(request);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/community", { waitUntil: "domcontentloaded" });

  const panel = page.getByRole("tabpanel");
  await expect(
    panel.getByRole("article", { exact: true, name: "최신 공개 글 1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "커뮤니티 글 더 보기" }),
  ).toHaveCount(0);

  await page.getByTestId("home-feed-sentinel").scrollIntoViewIfNeeded();
  await expect(
    panel.getByRole("article", { exact: true, name: "최신 공개 글 15" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("article", { exact: true, name: "최신 공개 글 1" }),
  ).toHaveCount(1);
});
