import { expect, test } from "@playwright/test";

for (const viewport of [
  { height: 900, label: "desktop", width: 1440 },
  { height: 844, label: "mobile", width: 390 },
] as const) {
  test(`keeps the new-user decision path clear on ${viewport.label}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.setViewportSize(viewport);
    await page.goto("/");

    const heading = page.getByRole("heading", {
      level: 1,
      name: "내 경력과 기술이 이어지는 커리어 방향을 확인하세요",
    });
    const primaryAction = page.getByRole("link", { name: "내 커리어 분석하기" });
    await expect(heading).toBeVisible();
    await expect(primaryAction).toBeVisible();
    await expect(
      page.getByRole("region", { name: "세 단계로 판단 근거까지 확인합니다" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", {
        name: "프로필 없이도 공고 범위를 살펴볼 수 있습니다",
      }),
    ).toBeVisible();
    await expect(page.getByText("3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?"))
      .toHaveCount(0);

    const headingSize = await heading.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(headingSize).toBeLessThanOrEqual(viewport.label === "mobile" ? 48 : 88);

    const bodyFamily = await page.locator("body").evaluate(
      (element) => getComputedStyle(element).fontFamily,
    );
    expect(bodyFamily).toContain("Pretendard");

    const actionBox = await primaryAction.boundingBox();
    expect(actionBox).not.toBeNull();
    expect(actionBox!.y + actionBox!.height).toBeLessThan(viewport.height);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
    expect(runtimeErrors).toEqual([]);
  });
}
