import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390]) {
  test(`keeps the production market hierarchy usable at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: width === 390 ? 844 : 900, width });
    await page.goto("/market");

    const title = page.getByRole("heading", { level: 1, name: "채용 시장" });
    await expect(title).toBeVisible();
    await expect
      .poll(() =>
        title.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
      )
      .toBeLessThanOrEqual(width <= 839 ? 28 : 32);

    await expect(
      page.getByText(/이직핏이 확인한 기업 공식 채용 공고 범위입니다/),
    ).toBeVisible();
    await expect(page.getByText(/국내 전체 채용시장을 의미하지 않습니다/)).toBeVisible();
    await expect(page.getByText("확인된 기술").locator("..")).toContainText(
      "69종",
    );
    await expect(page.getByText("데이터 출처").locator("..")).toContainText(
      "기업 공식 채용 홈페이지",
    );

    const demand = page.getByRole("region", { name: "기술 수요 순위" });
    await expect(demand).toBeVisible();
    await expect(
      demand.getByRole("button", { name: "Python 기술 선택" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(demand.getByText(/1위 기술 대비 상대적 수요/)).toBeVisible();
    await expect(demand.locator('[data-technology-icon="python"]')).toBeVisible();
    await expect(demand.locator('[data-technology-icon="cpu"]')).toBeVisible();
    await expect(demand.locator("[data-skill-row]")).toHaveCount(10);

    const trend = page.getByRole("region", { name: "기술 수요 추세" });
    await expect(trend.getByText("추세 수집 중")).toBeVisible();
    await expect(trend.getByText(/주간 데이터를 수집하고 있어요/)).toBeVisible();
    await expect(trend.locator("path[data-trend-line]")).toHaveCount(0);
    await expect(page.getByText("63%", { exact: true })).toHaveCount(0);

    await expect(
      page.getByRole("heading", { name: "Python 관련 최근 공고" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Python Backend Engineer/ }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    if (width <= 839) {
      const categoryFilters = page.getByRole("navigation", {
        name: "기술 분야",
      });
      await expect(categoryFilters).toHaveCSS("flex-wrap", "nowrap");
      await expect(categoryFilters).toHaveCSS("overflow-x", "auto");
    }

    for (const target of [
      page.getByRole("navigation", { name: "기술 분야" }).getByRole("link", {
        exact: true,
        name: "언어",
      }),
      demand.getByRole("link", { name: "Python 관련 공고 보기" }),
      page
        .getByLabel("데이터를 읽는 기준")
        .getByRole("link", { name: "분석 방법" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    expect(browserErrors).toEqual([]);
  });
}

test("updates jobs, co-occurrence and rank order without a document reload", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/market");

  const navigationEntries = await page.evaluate(() =>
    performance.getEntriesByType("navigation").length,
  );
  await page.getByRole("button", { name: "Docker 기술 선택" }).click();
  await expect(
    page.getByRole("heading", { name: "Docker 관련 최근 공고" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Go Platform Engineer/ })).toBeVisible();
  const combinations = page.getByRole("region", { name: "함께 등장한 기술" });
  await expect(combinations.getByText("Docker + Go")).toBeVisible();
  await expect(combinations.getByText("함께 등장한 공고 1건").first()).toBeVisible();

  await page.getByLabel("기술 정렬 기준").selectOption("name");
  await expect(
    page.locator("[data-skill-row]").first().getByRole("button"),
  ).toHaveAccessibleName("Airflow 기술 선택");
  expect(
    await page.evaluate(() => performance.getEntriesByType("navigation").length),
  ).toBe(navigationEntries);

  await page
    .getByRole("navigation", { name: "기술 분야" })
    .getByRole("link", { exact: true, name: "인프라" })
    .click();
  await expect(page).toHaveURL(/\/market\?category=infra$/);
  await expect(
    page
      .getByRole("navigation", { name: "기술 분야" })
      .getByRole("link", { exact: true, name: "인프라" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("region", { name: "시장 범위 필터" }),
  ).not.toHaveAttribute("aria-busy", "true");
  expect(
    await page.evaluate(() => performance.getEntriesByType("navigation").length),
  ).toBe(navigationEntries);
});

test("shows fit evidence only after real owned-skill analysis returns", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ejik-fit:owned-skills", JSON.stringify(["Python"]));
  });
  await page.goto("/market");

  await expect(
    page.getByText("내 기술과 하나 이상 일치하는 공고 17건"),
  ).toBeVisible();
  await expect(
    page.getByText(/Kubernetes를 요구하는 공고 10건을 다음 학습 후보/),
  ).toBeVisible();
});

test("carries selected market evidence into the jobs explorer", async ({
  page,
}) => {
  await page.goto("/market?category=infra&career_type=experienced");
  const demand = page.getByRole("region", { name: "기술 수요 순위" });
  await expect(demand.locator("[data-skill-row]")).toHaveCount(3);
  await expect(
    demand.getByRole("button", { name: "Python 기술 선택" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Docker 관련 공고 보기" }).click();

  await expect(page).toHaveURL(
    /\/jobs\?q=Docker&category=infra&career_type=experienced$/,
  );
  await expect(page.getByLabel("공고 검색")).toHaveValue("Docker");
  await expect(page.getByLabel("기술 분야")).toHaveValue("infra");
  await expect(page.getByLabel("경력 조건")).toHaveValue("experienced");
  await expect(page.getByText("현재 결과 1건")).toBeVisible();
});

test("applies career filters to the fixture with production API semantics", async ({
  page,
}) => {
  await page.goto("/market?career_type=new_comer");

  const demand = page.getByRole("region", { name: "기술 수요 순위" });
  await expect(demand.locator("[data-skill-row]")).toHaveCount(3);
  await expect(
    demand.getByRole("button", { name: "Go 기술 선택" }),
  ).toBeVisible();
  await expect(
    demand.getByRole("button", { name: "Python 기술 선택" }),
  ).toHaveCount(0);
});
