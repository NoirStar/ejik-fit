import { expect, test } from "@playwright/test";

const fixtureApi = "http://127.0.0.1:8011";

test.afterEach(async ({ request }) => {
  await request.post(`${fixtureApi}/__test__/reset`);
});

for (const width of [1440, 820, 390, 320] as const) {
  test(`keeps new-user onboarding compact at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "내 경험에서 이어갈 커리어 방향을 확인하세요",
      }),
    ).toBeVisible();
    const action = page.getByRole("link", { name: "내 커리어 분석하기" });
    const actionBox = await action.boundingBox();
    expect(actionBox?.y).toBeLessThan(900);
    expect(actionBox?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.locator(".brand-lockup__mark img")).toHaveAttribute(
      "src",
      /brand%2Fejik-fit-mascot\.png|brand\/ejik-fit-mascot\.png/,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });
}

test("uses one analysis snapshot across home, career map, and recommended jobs", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 820 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "careerfit:owned-skills",
      JSON.stringify(["Python", "Docker"]),
    );
    localStorage.setItem(
      "careerfit:career-profile",
      JSON.stringify({
        currentRole: "백엔드 개발자",
        pastRoles: [],
        experienceYears: 4,
        responsibilities: "Python API 개발과 Docker 기반 서비스 운영",
        experienceHighlights: [],
        workTypes: ["development", "operations"],
        industryExperience: [],
        currentDomain: "backend",
        keepExperience: "API 개발과 운영",
        interestDomains: ["cloud"],
        excludedDomains: ["ai"],
        preferredLocations: ["서울"],
        employmentTypes: ["full_time"],
        careerLevel: "experienced",
        skillUsage: {},
      }),
    );
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "백엔드 개발자 경험에서 이어갈 방향" }),
  ).toBeVisible();
  const homeAnalysis = page.locator("[data-analysis-snapshot]");
  await expect(homeAnalysis).toHaveAttribute(
    "data-analysis-version",
    "career-evidence-v3.0",
  );
  const snapshot = await homeAnalysis.getAttribute("data-analysis-snapshot");

  await page.goto("/career-map");
  await expect(page.getByRole("heading", { level: 1, name: "커리어 방향 비교" })).toBeVisible();
  await expect(page.locator("[data-analysis-snapshot]")).toHaveAttribute(
    "data-analysis-snapshot",
    snapshot!,
  );
  await expect(page.getByText("AI", { exact: true })).toHaveCount(0);

  await page.goto("/jobs?view=matched");
  await expect(page.locator("[data-analysis-snapshot]")).toHaveAttribute(
    "data-analysis-snapshot",
    snapshot!,
  );
  const jobText = await page.locator("#main-content").innerText();
  expect(jobText).not.toMatch(/FULL_TIME_WORKER|MILITARY_SERVICE_EXCEPTION/);
  await expect(
    page.getByRole("link", { exact: true, name: "Python Backend Engineer" }),
  ).toBeVisible();
});

test("migrates legacy profile data without deleting the old copy", async ({ page }) => {
  const legacyProfile = {
    currentRole: "플랫폼 엔지니어",
    pastRoles: [],
    experienceYears: 5,
    responsibilities: "컨테이너 플랫폼 운영과 배포 자동화",
    experienceHighlights: [],
    workTypes: ["operations", "automation"],
    industryExperience: [],
    currentDomain: "devops",
    keepExperience: "플랫폼 운영",
    interestDomains: [],
    excludedDomains: [],
    preferredLocations: [],
    employmentTypes: [],
    careerLevel: "experienced",
    skillUsage: {},
  };
  await page.addInitScript((profile) => {
    localStorage.setItem("ejik-fit:career-profile", JSON.stringify(profile));
    localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Docker", "Kubernetes"]),
    );
  }, legacyProfile);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "플랫폼 엔지니어 경험에서 이어갈 방향" }),
  ).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        currentProfile: localStorage.getItem("careerfit:career-profile"),
        currentSkills: localStorage.getItem("careerfit:owned-skills"),
        legacyProfile: localStorage.getItem("ejik-fit:career-profile"),
        legacySkills: localStorage.getItem("ejik-fit:owned-skills"),
      })),
    )
    .toEqual({
      currentProfile: JSON.stringify(legacyProfile),
      currentSkills: JSON.stringify(["Docker", "Kubernetes"]),
      legacyProfile: JSON.stringify(legacyProfile),
      legacySkills: JSON.stringify(["Docker", "Kubernetes"]),
    });
});

test("keeps canonical routes and distinguishes empty, partial, and failed market data", async ({
  page,
  request,
}) => {
  await page.goto("/skill-map?owned_skills=Python&source=shared");
  await expect(page).toHaveURL(
    /\/career-map\?owned_skills=Python&source=shared$/,
  );

  await page.goto("/market?category=mobile");
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "선택한 조건에 해당하는 기술 데이터가 없습니다.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await request.post(`${fixtureApi}/__test__/market-failures`, {
    data: { resources: ["graph"] },
  });
  await page.goto("/market?career_type=new_comer&field=devops");
  await expect(
    page.getByText(/기술 관계 표본은 불러오지 못했지만/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "분야별 채용 현황" }),
  ).toBeVisible();

  await request.post(`${fixtureApi}/__test__/market-failures`, {
    data: { resources: ["postings", "skills", "graph"] },
  });
  await page.goto("/market?career_type=mixed&category=qa");
  const market = page.locator("#main-content");
  await expect(market.getByRole("alert")).toHaveCount(1);
  await expect(
    market.getByRole("heading", { name: "시장 데이터를 불러오지 못했습니다." }),
  ).toBeVisible();
  await expect(market.getByText(/공고 0건/)).toHaveCount(0);
});
