import { expect, test } from "@playwright/test";

const starterTitle = "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?";

for (const width of [1440, 390]) {
  test(`keeps legacy starter follows out of the real following feed at ${width}px`, async ({
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
    await page.goto("/");

    const guide = page.getByRole("region", {
      name: "이직핏 커뮤니티 가이드",
    });
    await expect(
      guide.getByRole("link", { name: `${starterTitle} 예시 읽기` }),
    ).toBeVisible();
    await expect(guide.getByText("읽기 전용").first()).toBeVisible();
    await expect(guide.getByRole("button")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "팔로우 중인 글" }),
    ).toHaveCount(0);

    const followingTab = page.getByRole("tab", { name: "팔로잉" });
    await followingTab.click();
    await expect(followingTab).toHaveAttribute("aria-selected", "true");
    await expect(followingTab).toBeFocused();

    const panel = page.getByRole("tabpanel");
    await expect(
      panel.getByText("팔로우한 작성자가 없습니다."),
    ).toBeVisible();
    await expect(panel.getByText(starterTitle)).toHaveCount(0);
    await expect(
      guide.getByRole("link", { name: `${starterTitle} 예시 읽기` }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(browserErrors).toEqual([]);
  });
}
