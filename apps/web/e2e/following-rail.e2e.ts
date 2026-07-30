import { expect, test } from "@playwright/test";

import {
  resetCommunityFixture,
  seedFollowingFixture,
  signInCommunityViewer,
} from "./fixtures/community-auth";

const removedStarterTitle = "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?";

for (const width of [1440, 390]) {
  test(`keeps legacy synthetic follows out of the community feed at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "ejik-fit:social-interactions",
        JSON.stringify({
          followedAuthorIds: ["server-garden"],
          reactedPostIds: ["career-move-3y-backend"],
          savedPostIds: ["career-move-3y-backend"],
        }),
      );
    });
    await page.goto("/community");

    await expect(
      page.getByRole("heading", { name: "커리어 커뮤니티" }),
    ).toBeVisible();
    await expect(page.getByText(removedStarterTitle)).toHaveCount(0);
    await expect(page.getByText("예시 콘텐츠")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "팔로우 중인 글" }),
    ).toHaveCount(0);

    const followingTab = page.getByRole("tab", { name: "팔로잉" });
    await followingTab.click();
    await expect(followingTab).toHaveAttribute("aria-selected", "true");
    await expect(followingTab).toBeFocused();

    const panel = page.getByRole("tabpanel");
    await expect(
      panel.getByText("팔로우한 작성자의 글이 없습니다."),
    ).toBeVisible();
    await expect(panel.getByText(removedStarterTitle)).toHaveCount(0);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(browserErrors).toEqual([]);
  });
}

test("shows followed authors even when their post is outside the public first page", async ({
  page,
  request,
}) => {
  await resetCommunityFixture(request);
  await seedFollowingFixture(request);
  await signInCommunityViewer(page);

  const targetTitle = "공개 첫 페이지 밖의 팔로잉 글";
  await expect(page.getByRole("article", { name: targetTitle })).toHaveCount(0);

  await page.getByRole("tab", { name: "팔로잉" }).click();

  await expect(
    page.getByRole("article", { name: targetTitle }),
  ).toBeVisible();
});
