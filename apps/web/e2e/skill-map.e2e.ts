import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390]) {
  test(`keeps the evidence-led skill map usable at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    await page.goto("/skill-map?skill=Kubernetes");

    await expect(page).toHaveURL(/\/skills\/graph\?seed=Kubernetes$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "이직핏 기술 맵" }),
    ).toBeVisible();

    const productNavigation = page.getByRole("navigation", {
      name: width <= 820 ? "모바일 주요 탐색" : "주요 탐색",
    });
    await expect(
      productNavigation.getByRole("link", { name: "스킬맵" }),
    ).toHaveAttribute("aria-current", "page");

    const inspector = page.getByRole("complementary", {
      name: "선택 기술 분석",
    });
    await expect(
      inspector.getByRole("heading", { name: "Kubernetes" }),
    ).toBeVisible();
    await expect(inspector.getByText("1건", { exact: true }).first()).toBeVisible();
    await expect(
      inspector.getByRole("link", { name: /Python Backend Engineer/ }),
    ).toHaveAttribute("href", "/jobs/job-python");

    const quickSkills = page.getByRole("navigation", {
      name: "빠른 기술 선택",
    });
    await quickSkills.getByRole("button", { name: "Docker" }).click();
    await expect(
      inspector.getByRole("heading", { name: "Docker" }),
    ).toBeVisible();

    const graphFrame = page.getByTestId("skill-graph-frame");
    const graphBox = await graphFrame.boundingBox();
    expect(graphBox?.height).toBeGreaterThanOrEqual(width <= 640 ? 400 : 496);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    if (width <= 900) {
      const disclosure = page.locator("details").filter({
        hasText: "내 스택과 필터",
      });
      await expect(disclosure).not.toHaveAttribute("open", "");
      await disclosure.locator("summary").click();
      await expect(page.getByLabel("스킬 추가")).toBeVisible();
    }

    if (width === 390) {
      const quickTarget = await quickSkills
        .getByRole("button", { name: "Docker" })
        .boundingBox();
      expect(quickTarget?.height).toBeGreaterThanOrEqual(44);

      const mobileNavigation = page.getByRole("navigation", {
        name: "모바일 주요 탐색",
      });
      await expect(mobileNavigation).toBeVisible();
    }

    expect(browserErrors).toEqual([]);
  });
}
