import { expect, test } from "@playwright/test";

test("keeps career results and the shared profile synchronized on mobile", async ({
  page,
}) => {
  const analysisRequests: Array<Record<string, unknown>> = [];
  await page.setViewportSize({ height: 844, width: 390 });
  await page.addInitScript(() => {
    localStorage.setItem("ejik-fit:owned-skills", JSON.stringify(["Python"]));
    localStorage.setItem(
      "ejik-fit:career-profile",
      JSON.stringify({
        currentRole: "백엔드 개발자",
        pastRoles: [],
        experienceYears: 4,
        responsibilities: "Python API 개발과 서비스 운영",
        experienceHighlights: [],
        workTypes: ["development", "operations"],
        industryExperience: [],
        currentDomain: "backend",
        keepExperience: "API 개발",
        interestDomains: [],
        excludedDomains: [],
        preferredLocations: ["서울"],
        employmentTypes: ["full_time"],
        careerLevel: "experienced",
        skillUsage: {},
      }),
    );
  });
  page.on("request", (request) => {
    if (!request.url().includes("/api/career-analysis")) return;
    const body = request.postDataJSON();
    if (body && typeof body === "object") {
      analysisRequests.push(body as Record<string, unknown>);
    }
  });

  await page.goto("/career");
  await expect(
    page.getByRole("heading", {
      name: "백엔드 개발자 경험에서 확인한 방향",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "백엔드" })).toBeVisible();

  await page.getByText("프로필과 기술 수정", { exact: true }).click();
  await page.getByLabel("추가할 기술").fill("React");
  await page.getByRole("button", { exact: true, name: "추가" }).click();
  await expect(
    page.getByRole("list", { name: "사용 기술 목록" }),
  ).toContainText("React");

  const currentRole = page
    .getByLabel("현재 직무")
    .filter({ visible: true })
    .first();
  await currentRole.fill("클라우드 백엔드 개발자");
  await page.getByRole("button", { name: "커리어 프로필 저장" }).click();
  await expect(page.getByRole("status")).toContainText("프로필 저장 완료");
  await expect.poll(() => analysisRequests.at(-1)).toMatchObject({
    owned_skills: ["Python", "React"],
    profile: { current_role: "클라우드 백엔드 개발자" },
  });

  await expect
    .poll(() =>
      page.evaluate(() => ({
        currentProfile: JSON.parse(
          localStorage.getItem("careerfit:career-profile") ?? "{}",
        ).currentRole,
        legacyProfile: JSON.parse(
          localStorage.getItem("ejik-fit:career-profile") ?? "{}",
        ).currentRole,
        currentSkills: localStorage.getItem("careerfit:owned-skills"),
        legacySkills: localStorage.getItem("ejik-fit:owned-skills"),
      })),
    )
    .toEqual({
      currentProfile: "클라우드 백엔드 개발자",
      legacyProfile: "클라우드 백엔드 개발자",
      currentSkills: '["Python","React"]',
      legacySkills: '["Python","React"]',
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "클라우드 백엔드 개발자 경험에서 확인한 방향",
    }),
  ).toBeVisible();
  await page.getByText("프로필과 기술 수정", { exact: true }).click();
  await expect(
    page.getByLabel("현재 직무").filter({ visible: true }).first(),
  ).toHaveValue(
    "클라우드 백엔드 개발자",
  );
  await expect(
    page.getByRole("list", { name: "사용 기술 목록" }),
  ).toContainText("React");
});
