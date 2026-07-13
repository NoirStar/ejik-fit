import { expect, test } from "@playwright/test";

const viewports = [390, 360, 350, 341, 340, 320] as const;

for (const width of viewports) {
  test(`keeps the header legible and tappable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 844, width });
    await page.goto("/privacy");

    const brand = page.getByRole("link", { name: "이직핏 홈" });
    const brandCopy = brand.locator(".brand-lockup__copy");
    const koreanName = brandCopy.locator("strong");
    const englishName = brandCopy.locator("small");

    await expect(brand).toBeVisible();
    await expect(brand.locator(".brand-lockup__mark")).toBeVisible();

    if (width > 380) {
      await expect(koreanName).toBeVisible();
      await expect(englishName).toBeVisible();
    } else if (width > 340) {
      await expect(koreanName).toBeVisible();
      await expect(englishName).toBeHidden();
    } else {
      await expect(brandCopy).toBeHidden();
    }

    const targets = [
      { name: "brand", target: brand },
      {
        name: "search",
        target: page.getByRole("searchbox", { name: "통합 검색" }).locator(".."),
      },
      { name: "write", target: page.getByRole("link", { name: "글쓰기" }) },
      {
        name: "stack",
        target: page.getByRole("button", { name: "내 스택 열기" }),
      },
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
  });
}
