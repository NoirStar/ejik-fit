import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 600, 390]) {
  test(`keeps verified job detail usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: width === 390 ? 844 : 900, width });
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

    const title = page.getByRole("heading", {
      level: 1,
      name: "Python Backend Engineer",
    });
    const titleSize = await title.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(titleSize).toBeLessThanOrEqual(width <= 680 ? 28 : 34);
    expect(
      await title.evaluate((element) => getComputedStyle(element).wordBreak),
    ).toBe("keep-all");

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
      expect(factColumns.split(" ")).toHaveLength(2);
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
      const primaryActions = page.getByRole("group", { name: "지원 및 저장" });
      const facts = page.getByRole("heading", { name: "채용 조건" });
      const trust = page.getByRole("region", { name: "공고 신뢰 정보" });
      const navigation = page.getByRole("navigation", {
        name: "모바일 주요 탐색",
      });
      await expect(actions).toBeVisible();
      await expect(navigation).toBeVisible();
      const actionsBox = await primaryActions.boundingBox();
      const factsBox = await facts.boundingBox();
      const trustBox = await trust.boundingBox();
      expect(actionsBox).not.toBeNull();
      expect(factsBox).not.toBeNull();
      expect(trustBox).not.toBeNull();
      expect(factsBox!.y).toBeLessThan(trustBox!.y);
      expect(
        await primaryActions.evaluate(
          (element) => getComputedStyle(element).position,
        ),
      ).toBe("fixed");
      const navigationBox = await navigation.boundingBox();
      expect(navigationBox).not.toBeNull();
      expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(
        navigationBox!.y + 1,
      );
      const mainPaddingBottom = await page
        .locator("main")
        .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
      expect(mainPaddingBottom).toBeGreaterThanOrEqual(
        navigationBox!.height + actionsBox!.height,
      );
    }
  });
}
