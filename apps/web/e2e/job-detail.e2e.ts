import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 600, 390]) {
  test(`keeps verified job detail usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width });
    await page.addInitScript(() => {
      localStorage.setItem(
        "ejik-fit:owned-skills",
        JSON.stringify(["Python"]),
      );
    });

    await page.goto("/jobs");
    await page
      .getByRole("link", { name: "Python Backend Engineer" })
      .click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Python Backend Engineer",
      }),
    ).toBeVisible();
    await expect(page.getByText("내 기술과 겹침 1개")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "주요 업무" }),
    ).toBeVisible();
    await expect(page.getByText("Do not render this HTML")).toHaveCount(0);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    const apply = page.getByRole("link", {
      name: "공식 채용페이지에서 지원",
    });
    const save = page.getByRole("button", {
      name: "Python Backend Engineer 저장",
    });
    for (const target of [apply, save]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    if (width <= 680) {
      const factColumns = await page
        .getByRole("heading", { name: "채용 조건" })
        .locator("+ dl")
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      expect(factColumns.split(" ")).toHaveLength(1);
    }

    await save.click();
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Python Backend Engineer 저장 해제",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    if (width === 390) {
      const actions = page.getByRole("region", { name: "지원 준비" });
      const facts = page.getByRole("heading", { name: "채용 조건" });
      const navigation = page.getByRole("navigation", {
        name: "모바일 주요 탐색",
      });
      await expect(navigation).toBeVisible();
      const actionsBox = await actions.boundingBox();
      const factsBox = await facts.boundingBox();
      expect(actionsBox).not.toBeNull();
      expect(factsBox).not.toBeNull();
      expect(actionsBox!.y).toBeLessThan(factsBox!.y);
      expect(
        await actions.evaluate((element) => getComputedStyle(element).position),
      ).toBe("static");
      const navigationBox = await navigation.boundingBox();
      const mainPaddingBottom = await page
        .locator("main")
        .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
      expect(mainPaddingBottom).toBeGreaterThanOrEqual(navigationBox?.height ?? 0);
    }
  });
}
