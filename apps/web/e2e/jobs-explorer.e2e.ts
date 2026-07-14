import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 600, 390]) {
  test(`keeps verified jobs usable without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/jobs");

    await expect(page.getByText("현재 결과 2건")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Python Backend Engineer" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    for (const target of [
      page.getByRole("button", { name: "검색" }),
      page.getByRole("link", { name: "Python 스킬맵" }),
      page.getByRole("link", { name: "Python Backend Engineer" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    if (width <= 680) {
      const factColumns = await page
        .locator("dl")
        .first()
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      expect(factColumns.split(" ")).toHaveLength(1);
    }
  });
}

test("syncs owned skills, saved jobs, and URL filter resets on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.addInitScript(() => {
    localStorage.setItem("ejik-fit:owned-skills", JSON.stringify(["Go"]));
  });
  await page.goto("/jobs?q=Go&career_type=new_comer");

  await expect(page.getByLabel("공고 검색")).toHaveValue("Go");
  await expect(page.getByLabel("경력 조건")).toHaveValue("new_comer");
  await page.getByRole("button", { name: "내 기술 겹침 1" }).click();
  await expect(
    page.getByRole("link", { name: "Go Platform Engineer" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Go Platform Engineer 저장" }).click();
  await page.getByRole("button", { name: "저장한 공고 1" }).click();
  await expect(
    page.getByRole("link", { name: "Go Platform Engineer" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("ejik-fit:saved-job-ids")),
  ).toBe('["job-go"]');

  await page.getByRole("link", { name: "필터 초기화" }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByLabel("공고 검색")).toHaveValue("");
  await expect(page.getByLabel("경력 조건")).toHaveValue("");
});

test("combines query and career filters like the production API", async ({
  page,
}) => {
  await page.goto("/jobs?q=Go&career_type=experienced");

  await expect(page.getByText("현재 결과 0건")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go Platform Engineer" }),
  ).not.toBeVisible();
  await expect(page.getByText("조건에 맞는 공식 공고가 없습니다.")).toBeVisible();
});

test("keeps category filter actions together at tablet width", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 820 });
  await page.goto("/jobs?category=infra");

  await expect(page.getByLabel("기술 분야")).toHaveValue("infra");
  const searchBox = await page.getByRole("button", { name: "검색" }).boundingBox();
  const resetBox = await page.getByRole("link", { name: "필터 초기화" }).boundingBox();

  expect(searchBox).not.toBeNull();
  expect(resetBox).not.toBeNull();
  expect(Math.abs((searchBox?.y ?? 0) - (resetBox?.y ?? 0))).toBeLessThan(2);
  expect(searchBox?.height).toBeGreaterThanOrEqual(44);
  expect(resetBox?.height).toBeGreaterThanOrEqual(44);
});
