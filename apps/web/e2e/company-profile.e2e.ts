import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390]) {
  test(`keeps the actual-data company profile usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/jobs");
    await page
      .getByRole("link", { name: "NAVER 기업 채용 현황" })
      .click();

    await expect(page).toHaveURL(/\/companies\/naver$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "NAVER" }),
    ).toBeVisible();
    await expect(page.getByText("현재 공개 공고 1건")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Python Backend Engineer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go Platform Engineer" }),
    ).toHaveCount(0);
    await expect(page.getByTitle("네이버 로고")).toBeVisible();
    await expect(page.locator('a[href="/jobs"][aria-current="page"]')).toHaveCount(2);
    await expect(page.getByText(/직원 수|평균 연봉|성장률|기업 평점/)).toHaveCount(0);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    for (const target of [
      page.getByRole("link", { name: "공고 탐색으로 돌아가기" }),
      page.getByRole("link", { name: "Python Backend Engineer" }),
      page.getByRole("link", { name: "Docker 스킬맵" }),
      page.getByRole("link", { name: "최근 공식 원문" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    const jobs = page.getByRole("region", { name: "현재 공개 공고" });
    const workspaceColumns = await jobs.evaluate(
      (element) =>
        getComputedStyle(element.parentElement as HTMLElement).gridTemplateColumns,
    );
    expect(workspaceColumns.split(" ")).toHaveLength(width > 960 ? 2 : 1);

    if (width <= 680) {
      const metricColumns = await page
        .getByRole("heading", { name: "현재 기업 채용 스냅샷" })
        .locator("+ dl")
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      expect(metricColumns.split(" ")).toHaveLength(1);

      const navigation = page.getByRole("navigation", {
        name: "모바일 주요 탐색",
      });
      await expect(navigation).toBeVisible();
      const navigationBox = await navigation.boundingBox();
      const mainPaddingBottom = await page
        .locator("main")
        .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
      expect(mainPaddingBottom).toBeGreaterThanOrEqual(navigationBox?.height ?? 0);
    }
  });
}

test("moves from a company profile to the verified job detail", async ({ page }) => {
  await page.goto("/companies/naver");
  await page.getByRole("link", { name: "Python Backend Engineer" }).click();

  await expect(page).toHaveURL(/\/jobs\/job-python$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Python Backend Engineer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "NAVER 기업 채용 현황" }),
  ).toHaveAttribute("href", "/companies/naver");
});
