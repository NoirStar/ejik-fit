import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`explains the CareerFit decision flow without a profile at ${width}px`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "내 경력과 기술이 이어지는 커리어 방향을 확인하세요",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "내 커리어 분석하기" }),
    ).toHaveAttribute("href", "/career");
    await expect(
      page.getByRole("heading", { name: "분석 데이터의 범위" }),
    ).toBeVisible();
    await expect(page.getByText(/대한민국 전체 채용시장을 대표하지 않습니다/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "커리어 커뮤니티" })).toHaveCount(0);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(pageErrors).toEqual([]);
  });
}

test("migrates an existing profile and refreshes home and career map decisions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python", "Docker"]),
    );
    localStorage.setItem(
      "ejik-fit:career-profile",
      JSON.stringify({
        currentRole: "플랫폼 엔지니어",
        pastRoles: ["백엔드 개발자"],
        experienceYears: 5,
        responsibilities: "API 개발과 배포 자동화, 운영 장애 대응",
        workTypes: ["development", "operations", "automation"],
        industryExperience: ["핀테크"],
        currentDomain: "backend",
        keepExperience: "대규모 트래픽 운영",
        interestDomains: ["cloud"],
        excludedDomains: [],
        preferredLocations: ["서울"],
        employmentTypes: ["full_time"],
        careerLevel: "experienced",
        skillUsage: {},
      }),
    );
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "플랫폼 엔지니어 경험에서 이어갈 방향",
    }),
  ).toBeVisible();
  await expect(page.getByText("경력 기준 분석", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("careerfit:career-profile")),
  ).not.toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("ejik-fit:career-profile")),
  ).not.toBeNull();

  await page.goto("/career");
  await expect(page.getByLabel("현재 직무")).toHaveValue("플랫폼 엔지니어");
  await page.getByLabel("현재 직무").fill("클라우드 플랫폼 엔지니어");
  await page.getByRole("button", { name: "커리어 프로필 저장" }).click();
  await expect(
    page.getByRole("status").filter({
      hasText: "커리어 프로필을 저장했습니다",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      const current = JSON.parse(
        localStorage.getItem("careerfit:career-profile") ?? "{}",
      );
      const legacy = JSON.parse(
        localStorage.getItem("ejik-fit:career-profile") ?? "{}",
      );
      return [current.currentRole, legacy.currentRole];
    }),
  ).toEqual(["클라우드 플랫폼 엔지니어", "클라우드 플랫폼 엔지니어"]);

  await page.goto("/skill-map");
  await expect(page.getByRole("heading", { level: 1, name: "커리어맵" })).toBeVisible();
  await expect(page.getByRole("region", { name: "내 커리어 방향 지도" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "관계의 의미" })).toBeVisible();
  await expect(page.getByRole("link", { name: "기술 관계 보기" })).toHaveAttribute(
    "href",
    "/skills/graph",
  );
});
