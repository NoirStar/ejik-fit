import { expect, test } from "@playwright/test";

for (const viewport of [
  { height: 900, label: "desktop", width: 1440 },
  { height: 844, label: "mobile", width: 390 },
] as const) {
  test(`keeps the home feed compact on ${viewport.label}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.setViewportSize(viewport);
    await page.goto("/");

    const heading = page.getByRole("heading", {
      name: "커리어 이야기 둘러보기",
    });
    const firstArticle = page.getByRole("article").first();
    await expect(heading).toBeVisible();
    await expect(firstArticle).toBeVisible();

    const headingSize = await heading.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(headingSize).toBeLessThanOrEqual(viewport.label === "mobile" ? 20 : 22);

    const bodyFamily = await page.locator("body").evaluate(
      (element) => getComputedStyle(element).fontFamily,
    );
    expect(bodyFamily).toContain("Pretendard");

    const firstBox = await firstArticle.boundingBox();
    expect(firstBox).not.toBeNull();
    expect(firstBox!.y).toBeLessThan(viewport.height);

    if (viewport.label === "desktop") {
      const secondBox = await page.getByRole("article").nth(1).boundingBox();
      expect(secondBox).not.toBeNull();
      expect(secondBox!.y).toBeLessThan(900);
    }

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
    expect(runtimeErrors).toEqual([]);
  });
}
