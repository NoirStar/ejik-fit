import { expect, test } from "@playwright/test";

const title = "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?";

for (const width of [1440, 390]) {
  test(`keeps followed example posts synchronized in the home rail at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    let rail = page.getByRole("region", { name: "팔로우 중인 예시 글" });
    await expect(rail).toContainText("아직 팔로우한 예시 작성자가 없습니다.");
    const emptyAction = rail.getByRole("button", { name: "추천 탭에서 찾기" });
    const emptyActionBox = await emptyAction.boundingBox();
    expect(emptyActionBox?.width).toBeGreaterThanOrEqual(44);
    expect(emptyActionBox?.height).toBeGreaterThanOrEqual(44);

    let article = page.getByRole("article", { name: title });
    const follow = article.getByRole("button", { name: "서버정원 팔로우" });
    await expect(follow).toBeEnabled();
    await follow.click();

    let railLink = rail.getByRole("link", {
      name: `서버정원의 글: ${title}`,
    });
    await expect(railLink).toHaveAttribute("href", "/posts/career-move-3y-backend");
    const railLinkBox = await railLink.boundingBox();
    expect(railLinkBox?.width).toBeGreaterThanOrEqual(44);
    expect(railLinkBox?.height).toBeGreaterThanOrEqual(44);

    await railLink.click();
    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: title }),
    ).toBeVisible();
    await page.goBack();

    rail = page.getByRole("region", { name: "팔로우 중인 예시 글" });
    railLink = rail.getByRole("link", { name: `서버정원의 글: ${title}` });
    await expect(railLink).toBeVisible();
    await rail.getByRole("button", { name: "팔로잉 탭 보기" }).click();
    const followingTab = page.getByRole("tab", { name: "팔로잉" });
    await expect(followingTab).toHaveAttribute("aria-selected", "true");
    await expect(followingTab).toBeFocused();

    article = page.getByRole("article", { name: title });
    await article.getByRole("button", { name: "서버정원 팔로우 해제" }).click();
    await expect(rail).toContainText("아직 팔로우한 예시 작성자가 없습니다.");
    await expect(page.getByText("팔로우한 작성자가 없습니다.")).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(browserErrors).toEqual([]);
  });
}
