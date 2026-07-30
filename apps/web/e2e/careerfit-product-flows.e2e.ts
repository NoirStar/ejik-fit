import { expect, test } from "@playwright/test";

test("connects a profile to a posting, its evidence, and a saved career group", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 390 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python", "Docker"]),
    );
    localStorage.setItem(
      "ejik-fit:career-profile",
      JSON.stringify({
        currentRole: "백엔드 개발자",
        pastRoles: [],
        experienceYears: 4,
        responsibilities: "Python API 개발과 Docker 기반 운영",
        workTypes: ["development", "operations"],
        industryExperience: [],
        currentDomain: "backend",
        keepExperience: "API 개발과 운영",
        interestDomains: ["cloud"],
        excludedDomains: [],
        preferredLocations: ["서울"],
        employmentTypes: ["full_time"],
        careerLevel: "experienced",
        skillUsage: {},
      }),
    );
  });

  await page.goto("/jobs");
  await expect(page.getByRole("heading", { level: 1, name: "채용공고 찾기" })).toBeVisible();
  await page.getByRole("button", { name: /추천 공고/ }).click();
  const posting = page.locator("article").filter({
    has: page.getByRole("link", {
      exact: true,
      name: "Python Backend Engineer",
    }),
  });
  await expect(posting).toBeVisible();
  const recommendation = posting.getByRole("region", {
    name: "Python Backend Engineer 추천 근거",
  });
  await expect(recommendation.getByText("경험 활용도가 높은 인접 분야")).toBeVisible();
  await expect(recommendation).toContainText("Python, Docker");
  await posting
    .getByRole("button", { name: "Python Backend Engineer 저장" })
    .click();
  await posting.getByRole("link", { name: "Python Backend Engineer" }).click();

  await expect(
    page.getByRole("heading", { level: 3, name: "내 커리어와 연결되는 이유" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "공식 채용 페이지에서 지원" }).first(),
  ).toHaveAttribute("href", "https://recruit.navercorp.com/job-python");
  await expect(page.getByRole("heading", { name: "출처와 검증" })).toBeVisible();

  await page.goto("/career/saved");
  const saved = page.getByRole("article", { name: "Python Backend Engineer" });
  await expect(saved).toBeVisible();
  const careerGroup = saved.getByRole("combobox", {
    name: "Python Backend Engineer 커리어 분류",
  });
  await careerGroup.selectOption("adjacent");
  await expect(careerGroup).toHaveValue("adjacent");
  await page.reload();
  await expect(
    page
      .getByRole("article", { name: "Python Backend Engineer" })
      .getByRole("combobox", {
        name: "Python Backend Engineer 커리어 분류",
      }),
  ).toHaveValue("adjacent");
  expect(
    await page.evaluate(() => ({
      current: localStorage.getItem("careerfit:saved-job-groups"),
      legacy: localStorage.getItem("ejik-fit:saved-job-groups"),
    })),
  ).toEqual({
    current: '{"job-python":"adjacent"}',
    legacy: '{"job-python":"adjacent"}',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});

for (const width of [1440, 390]) {
  test(`compares career fields with posting and company counts at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/market");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "분야별 채용 현황과 기술 수요",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "분야별 채용 현황" }),
    ).toBeVisible();
    const fields = page.getByRole("group", { name: "커리어 분야 선택" });
    await expect(fields.getByRole("button").first()).toContainText(/공고 \d+건 · 기업 \d+곳/);
    await expect(page.getByText(/전체 채용시장을 대표하지 않습니다/)).toBeVisible();

    const comparison = page.getByRole("region", { name: "커리어 분야 비교" });
    if (await comparison.count()) {
      const select = comparison.getByLabel("비교할 분야");
      const optionValue = await select.locator("option").nth(1).getAttribute("value");
      expect(optionValue).toBeTruthy();
      await select.selectOption(optionValue!);
      await expect(comparison.locator("article")).toHaveCount(2);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  });
}

test("keeps the personalized home separate from community writing", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "커리어 커뮤니티" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "글쓰기" })).toHaveCount(0);

  await page.goto("/community");
  await expect(
    page.getByRole("heading", { level: 1, name: "커리어 커뮤니티" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "글쓰기" }).click();
  await expect(
    page.getByRole("dialog", { name: "커뮤니티 글쓰기" }),
  ).toBeVisible();
  await expect(page.getByText("시작 글", { exact: true })).toHaveCount(0);
});
