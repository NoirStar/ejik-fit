import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const COMMUNITY_FIXTURE_ORIGIN = "http://127.0.0.1:8011";
export const COMMUNITY_TEST_EMAIL = "community@example.com";
export const COMMUNITY_TEST_PASSWORD = "FixturePass123";

export async function resetCommunityFixture(request: APIRequestContext) {
  const response = await request.post(
    `${COMMUNITY_FIXTURE_ORIGIN}/__test__/reset`,
  );
  if (!response.ok()) {
    throw new Error(
      `Community fixture reset failed with status ${response.status()}`,
    );
  }
}

export async function seedFollowingFixture(request: APIRequestContext) {
  const response = await request.post(
    `${COMMUNITY_FIXTURE_ORIGIN}/__test__/seed-following`,
  );
  if (!response.ok()) {
    throw new Error(
      `Community following fixture seed failed with status ${response.status()}`,
    );
  }
}

export async function signInCommunityViewer(
  page: Page,
  nextPath = "/",
) {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByLabel("이메일").fill(COMMUNITY_TEST_EMAIL);
  await page.getByLabel("비밀번호").fill(COMMUNITY_TEST_PASSWORD);
  await page.getByRole("button", { exact: true, name: "로그인" }).click();
  await expect(page).toHaveURL(
    new RegExp(`${nextPath.replace("?", "\\?")}$`),
  );
  await expect(
    page.getByRole("button", { name: "사용자 메뉴 열기" }),
  ).toContainText("community");
}
