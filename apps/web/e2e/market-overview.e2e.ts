import { expect, test } from "@playwright/test";

const viewports = [
  { height: 900, width: 1440 },
  { height: 900, width: 768 },
  { height: 900, width: 600 },
  { height: 896, width: 414 },
  { height: 812, width: 375 },
  { height: 700, width: 320 },
] as const;

for (const { height, width } of viewports) {
  test(`keeps the production market hierarchy usable at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height, width });
    await page.goto("/market");

    const title = page.getByRole("heading", {
      level: 1,
      name: "분야별 채용 현황과 기술 수요",
    });
    await expect(title).toBeVisible();
    await expect
      .poll(() =>
        title.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
      )
      .toBeLessThanOrEqual(width <= 839 ? 28 : 32);

    await expect(
      page.getByText(/커리어핏이 분석한 채용공고 범위/),
    ).toBeVisible();
    await expect(
      page.getByText(/국내 전체 채용시장 통계가 아닙니다/),
    ).toBeVisible();
    const pulse = page.getByRole("region", { name: "현재 채용시장 요약" });
    await expect(pulse).toContainText("필수·우대 공고 1위");
    await expect(pulse).toContainText("LLM · 44건");
    await expect(pulse).toContainText("2건 · 69종");
    await expect(pulse).toContainText("1/4주 수집 중");
    await expect(
      page.getByRole("region", { name: "채용 시장 데이터 요약" }),
    ).toHaveCount(0);

    const demand = page.getByRole("region", { name: "기술 수요 현황" });
    await expect(demand).toBeVisible();
    await expect(
      demand.getByRole("button", { name: "LLM 기술 선택" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      demand.getByText(/1위 대비 길이/),
    ).toBeVisible();
    await expect(demand.locator('[data-technology-icon="python"]')).toBeVisible();
    await expect(demand.locator('[data-technology-icon="cpu"]').first()).toBeVisible();
    await expect(demand.locator("[data-skill-row]")).toHaveCount(8);
    await expect(
      demand.getByRole("button", { name: "전체 69개 기술 보기" }),
    ).toBeVisible();

    const trend = page.getByRole("region", { name: "기술 수요 추세" });
    await expect(trend.getByText("추세 수집 중")).toBeVisible();
    await expect(trend.getByText(/주간 데이터를 수집하고 있어요/)).toBeVisible();
    await expect(
      trend.getByText("모든 경력 조건·모든 기술 분류 기준"),
    ).toBeVisible();
    await expect(trend.locator("path[data-trend-line]")).toHaveCount(0);

    const evidence = page.getByRole("region", { name: "LLM 시장 근거" });
    await expect(evidence).toBeVisible();
    await expect(
      evidence.getByRole("link", { name: "기술 관계 보기" }),
    ).toBeVisible();
    await expect(
      page
        .getByLabel("데이터를 읽는 기준")
        .getByText(/기술은 확인됐지만 채용공고 내용에서 필수·우대 여부/),
    ).toBeVisible();
    await expect(page.getByText(/내 기술을 저장하면|다음 학습 후보/)).toHaveCount(
      0,
    );
    await expect(page.getByText("63%", { exact: true })).toHaveCount(0);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    if (width <= 839) {
      const categoryFilters = page.getByRole("navigation", {
        name: "기술 분류",
      });
      await expect(categoryFilters).toHaveCSS("flex-wrap", "nowrap");
      await expect(categoryFilters).toHaveCSS("overflow-x", "auto");
    }

    const categoryFilter = page
      .getByRole("navigation", { name: "기술 분류" })
      .getByRole("link", { exact: true, name: "언어" });
    const categoryFilterBox = await categoryFilter.boundingBox();
    expect(categoryFilterBox?.width).toBeGreaterThanOrEqual(44);
    expect(categoryFilterBox?.height).toBe(width <= 575 ? 44 : 32);

    for (const target of [
      demand.getByRole("link", { name: "LLM 관련 공고 보기" }),
      evidence.getByRole("link", { name: "기술 관계 보기" }),
      page
        .getByLabel("데이터를 읽는 기준")
        .getByRole("link", { name: "분석 방법" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    const fields = page.getByRole("region", { name: "분야별 채용 현황" });
    const fieldsBox = await fields.boundingBox();
    const pulseBox = await pulse.boundingBox();
    const demandBox = await demand.boundingBox();
    const firstDemandRowBox = await demand.locator("[data-skill-row]").first().boundingBox();
    expect(fieldsBox?.y).toBeLessThan(height);
    expect(pulseBox?.y).toBeGreaterThan(fieldsBox?.y ?? 0);
    expect(demandBox?.y).toBeGreaterThan(pulseBox?.y ?? 0);
    expect(firstDemandRowBox?.y).toBeGreaterThan(demandBox?.y ?? 0);
    expect(demandBox?.height).toBeGreaterThan(300);

    if (width <= 839) {
      const mobileNavigation = page.getByRole("navigation", {
        name: "모바일 주요 탐색",
      });
      const mobileNavigationBox = await mobileNavigation.boundingBox();
      expect(mobileNavigationBox).not.toBeNull();
      const mainPaddingBottom = await page
        .locator("main")
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom));
      expect(mainPaddingBottom).toBeGreaterThanOrEqual(mobileNavigationBox!.height);
    }

    expect(browserErrors).toEqual([]);
  });
}

test("updates evidence and rank order without a document reload", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/market");

  const navigationEntries = await page.evaluate(() =>
    performance.getEntriesByType("navigation").length,
  );
  await page.getByRole("button", { name: "Docker 기술 선택" }).click();
  const evidence = page.getByRole("region", { name: "Docker 시장 근거" });
  await expect(evidence).toBeVisible();
  await expect(
    evidence.getByRole("link", { name: /Go Platform Engineer/ }),
  ).toBeVisible();
  await expect(evidence.getByText("Go", { exact: true })).toBeVisible();
  await expect(evidence.getByText("함께 1건").first()).toBeVisible();

  await page.getByLabel("기술 정렬 기준").selectOption("name");
  await expect(
    page.locator("[data-skill-row]").first().getByRole("button"),
  ).toHaveAccessibleName("Airflow 기술 선택");
  expect(
    await page.evaluate(() => performance.getEntriesByType("navigation").length),
  ).toBe(navigationEntries);

  await page
    .getByRole("navigation", { name: "기술 분류" })
    .getByRole("link", { exact: true, name: "인프라" })
    .click();
  await expect(page).toHaveURL(/\/market\?category=infra$/);
  await expect(
    page
      .getByRole("navigation", { name: "기술 분류" })
      .getByRole("link", { exact: true, name: "인프라" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("region", { name: "시장 범위 필터" }),
  ).not.toHaveAttribute("aria-busy", "true");
  expect(
    await page.evaluate(() => performance.getEntriesByType("navigation").length),
  ).toBe(navigationEntries);
});

test("carries selected market evidence into the jobs explorer", async ({
  page,
}) => {
  await page.goto("/market?category=infra&career_type=experienced");
  const demand = page.getByRole("region", { name: "기술 수요 현황" });
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
  await expect(
    page.locator("#main-content").getByText("전체 채용공고 1건"),
  ).toBeVisible();
});

test("applies career filters to the fixture with production API semantics", async ({
  page,
}) => {
  await page.goto("/market?career_type=new_comer");

  const demand = page.getByRole("region", { name: "기술 수요 현황" });
  await expect(demand.locator("[data-skill-row]")).toHaveCount(3);
  await expect(
    demand.getByRole("button", { name: "Go 기술 선택" }),
  ).toBeVisible();
  await expect(
    demand.getByRole("button", { name: "Python 기술 선택" }),
  ).toHaveCount(0);
});
