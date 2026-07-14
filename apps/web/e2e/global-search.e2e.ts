import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390]) {
  test(`searches verified data without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    const globalSearch = page.getByRole("searchbox", { name: "통합 검색" });
    await globalSearch.fill("Python");
    await globalSearch.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=Python$/);
    await expect(
      page.getByRole("heading", { name: "“Python” 검색 결과" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "NAVER 기업 채용 현황" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Python Backend Engineer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go Platform Engineer" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Python 스킬맵 보기" }),
    ).toBeVisible();
    await expect(page.getByText("공식 공고", { exact: true })).toBeVisible();
    await expect(page.getByText("공고 통계 표본")).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    for (const target of [
      page.getByRole("button", { name: "검색" }),
      page.getByRole("link", { name: /기업.*1/ }),
      page.getByRole("link", { name: "NAVER 기업 채용 현황" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("moves between actual result scopes and explicitly marked mock community", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/search?q=Kubernetes");

  await page.getByRole("link", { name: /커뮤니티.*1/ }).click();
  await expect(page).toHaveURL(
    "/search?q=Kubernetes&scope=community",
  );
  await expect(
    page.getByRole("link", {
      name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
    }),
  ).toBeVisible();
  await expect(page.getByText("예시 콘텐츠")).toBeVisible();
  await expect(
    page.getByText(/실제 사용자가 작성한 글이 아닙니다/),
  ).toBeVisible();

  await page.getByRole("link", { name: /기술.*1/ }).click();
  await expect(page).toHaveURL("/search?q=Kubernetes&scope=skills");
  await page
    .getByRole("link", { name: "Kubernetes 스킬맵 보기" })
    .click();
  await expect(page).toHaveURL(/\/skill-map\?skill=Kubernetes$/);

  await page.goto("/search?q=Python&scope=companies");
  await page
    .getByRole("link", { name: "NAVER 기업 채용 현황" })
    .click();
  await expect(page).toHaveURL(/\/companies\/naver$/);
  await expect(page.getByRole("heading", { name: "NAVER" })).toBeVisible();
});
