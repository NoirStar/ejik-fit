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
      exact: true,
      name: "커리어 이야기",
    });
    const feedPanel = page.getByRole("tabpanel", { name: "둘러보기" });
    const firstArticle = feedPanel.getByRole("article").first();
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

    const articlePositions = await feedPanel.evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>(":scope > article")]
        .slice(0, 2)
        .map((article) => {
          const box = article.getBoundingClientRect();
          return {
            height: box.height,
            top: box.top,
            visible: article.checkVisibility(),
            width: box.width,
          };
        }),
    );
    expect(articlePositions.length).toBeGreaterThan(0);
    expect(articlePositions[0]).toMatchObject({ visible: true });
    expect(articlePositions[0].height).toBeGreaterThan(0);
    expect(articlePositions[0].width).toBeGreaterThan(0);
    expect(articlePositions[0].top).toBeLessThan(viewport.height);

    if (viewport.label === "desktop") {
      expect(articlePositions.length).toBeGreaterThan(1);
      expect(articlePositions[1]).toMatchObject({ visible: true });
      expect(articlePositions[1].height).toBeGreaterThan(0);
      expect(articlePositions[1].width).toBeGreaterThan(0);
      expect(articlePositions[1].top).toBeLessThan(900);
    }

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
    expect(runtimeErrors).toEqual([]);
  });
}
