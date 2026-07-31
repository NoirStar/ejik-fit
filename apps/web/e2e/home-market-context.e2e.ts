import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`keeps a migrated profile aligned with personalized home evidence at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

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

    await expect.poll(() => {
      const url = new URL(page.url());
      return {
        careerType: url.searchParams.get("career_type"),
        ownedSkills: url.searchParams.getAll("owned_skills"),
        targetDomain: url.searchParams.get("target_domain"),
      };
    }).toEqual({
      careerType: "experienced",
      ownedSkills: ["Python"],
      targetDomain: "backend",
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
        page.evaluate(() => localStorage.getItem("careerfit:owned-skills")),
      )
      .toBe('["Python"]');
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
