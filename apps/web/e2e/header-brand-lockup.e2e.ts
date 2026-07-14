import { expect, test } from "@playwright/test";

const viewports = [390, 360, 350, 341, 340, 320] as const;

for (const width of viewports) {
  test(`keeps the header legible and tappable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 844, width });
    await page.goto("/privacy");

    const brand = page.getByRole("link", { name: "이직핏 홈" });
    const asset = brand.locator(".brand-lockup__asset");

    await expect(brand).toBeVisible();
    await expect(asset).toBeVisible();
    await expect(asset).toHaveAttribute(
      "src",
      "/brand/ejik-fit-wordmark.svg",
    );
    await expect(brand.locator(".brand-lockup__mark")).toHaveCount(0);
    await expect(page.getByText("EJIK FIT")).toHaveCount(0);

    const targets = [
      { name: "brand", target: brand },
      {
        name: "search",
        target: page.getByRole("searchbox", { name: "통합 검색" }).locator(".."),
      },
      { name: "write", target: page.getByRole("link", { name: "글쓰기" }) },
      {
        name: "notifications",
        target: page.getByRole("button", { name: "알림 열기" }),
      },
      {
        name: "user menu",
        target: page.getByRole("button", { name: "사용자 메뉴 열기" }),
      },
    ];

    for (const { name, target } of targets) {
      const box = await target.boundingBox();
      expect(box, `${name} should have a rendered box`).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.getByRole("button", { name: "알림 열기" }).click();
    const notification = page.getByLabel("알림", { exact: true });
    const notificationBox = await notification.boundingBox();
    expect(notificationBox).not.toBeNull();
    expect(notificationBox!.x).toBeGreaterThanOrEqual(16);
    expect(notificationBox!.width).toBeGreaterThanOrEqual(width - 32);
  });
}

test("keeps utility menus below the single desktop header", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1536 });
  await page.goto("/privacy");

  const header = page.locator("header").first();
  const headerBox = await header.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.height).toBeLessThanOrEqual(64);

  const navigation = page.getByRole("navigation", { name: "주요 탐색" });
  const navigationLinkYs = await navigation.getByRole("link").evaluateAll((links) =>
    links.map((link) => Math.round(link.getBoundingClientRect().y)),
  );
  expect(new Set(navigationLinkYs).size).toBe(1);

  for (const control of [
    { button: "알림 열기", menu: "알림" },
    { button: "사용자 메뉴 열기", menu: "사용자 메뉴" },
  ]) {
    await page.getByRole("button", { name: control.button }).click();
    const menu = page.getByLabel(control.menu, { exact: true });
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height + 8);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  }
});

for (const width of [981, 980, 940, 840, 821] as const) {
  test(`keeps header regions separate at the tablet boundary ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/privacy");

    const desktopNavigation = page.getByRole("navigation", {
      exact: true,
      name: "주요 탐색",
    });
    const mobileNavigation = page.getByRole("navigation", {
      exact: true,
      name: "모바일 주요 탐색",
    });

    if (width <= 980) {
      await expect(desktopNavigation).toBeHidden();
      await expect(mobileNavigation).toBeVisible();
    } else {
      await expect(desktopNavigation).toBeVisible();
      await expect(mobileNavigation).toBeHidden();

      const searchBox = await page
        .getByRole("searchbox", { name: "통합 검색" })
        .locator("..")
        .boundingBox();
      const navigationBox = await desktopNavigation.boundingBox();
      const firstUtilityBox = await page
        .getByRole("link", { name: "글쓰기" })
        .boundingBox();
      expect(searchBox).not.toBeNull();
      expect(navigationBox).not.toBeNull();
      expect(firstUtilityBox).not.toBeNull();
      expect(searchBox!.x + searchBox!.width).toBeLessThanOrEqual(
        navigationBox!.x,
      );
      expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(
        firstUtilityBox!.x,
      );
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  });
}
