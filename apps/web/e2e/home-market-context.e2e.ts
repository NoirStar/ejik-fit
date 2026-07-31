import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`keeps a migrated profile aligned with personalized home evidence at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    let analysisRequest: Record<string, unknown> | null = null;
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("request", (request) => {
      if (!request.url().includes("/api/career-analysis")) return;
      const body = request.postDataJSON();
      if (body && typeof body === "object") {
        analysisRequest = body as Record<string, unknown>;
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem(
        "ejik-fit:owned-skills",
        JSON.stringify(["Python"]),
      );
      localStorage.setItem(
        "ejik-fit:career-preferences",
        JSON.stringify({
          careerCondition: "experienced",
          targetDomain: "backend",
        }),
      );
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
    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => analysisRequest).toMatchObject({
      owned_skills: ["Python"],
      profile: {
        career_level: "experienced",
        current_domain: "backend",
        current_role: "백엔드 개발자",
      },
    });

    const directions = page.getByRole("region", {
      name: "먼저 확인할 커리어 방향",
    });
    await expect(directions).toContainText("백엔드");
    await expect(directions).toContainText("공고 수");
    await expect(directions).toContainText("기업 수");
    await expect(
      page.getByRole("link", { name: "NAVER Python Backend Engineer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", { name: "Go Platform Engineer" }),
    ).toHaveCount(0);

    await expect
      .poll(() =>
        page.evaluate(() => ({
          currentPreferences: localStorage.getItem(
            "careerfit:career-preferences",
          ),
          currentSkills: localStorage.getItem("careerfit:owned-skills"),
          legacyPreferences: localStorage.getItem(
            "ejik-fit:career-preferences",
          ),
          legacySkills: localStorage.getItem("ejik-fit:owned-skills"),
        })),
      )
      .toEqual({
        currentPreferences: JSON.stringify({
          careerCondition: "experienced",
          targetDomain: "backend",
        }),
        currentSkills: '["Python"]',
        legacyPreferences: JSON.stringify({
          careerCondition: "experienced",
          targetDomain: "backend",
        }),
        legacySkills: '["Python"]',
      });
    const edit = page.getByRole("link", { name: "프로필 정보 추가" });
    const editBox = await edit.boundingBox();
    expect(editBox?.width).toBeGreaterThanOrEqual(44);
    expect(editBox?.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    await edit.click();
    await expect(page).toHaveURL(/\/career$/);
    await page.getByText("프로필과 기술 수정", { exact: true }).click();
    await page.getByRole("button", { name: "경력 정보 더 추가" }).click();
    await expect(page.getByLabel("경력 수준")).toHaveValue("experienced");
    await expect(page.getByLabel("현재 분야")).toHaveValue("backend");
    expect(browserErrors).toEqual([]);
  });
}
