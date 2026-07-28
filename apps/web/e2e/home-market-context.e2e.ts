import { expect, test } from "@playwright/test";

for (const width of [1440, 390, 320]) {
  test(`keeps saved market conditions aligned with actual home data at ${width}px`, async ({
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

    const context = page.getByRole("region", { name: "내 커리어 브리핑" });
    await expect(context).toContainText("경력 · 백엔드");
    await expect(context).toContainText("맞는 공고");
    await expect(context).toContainText("현재 수요 상위");
    const contextBox = await context.boundingBox();
    expect(contextBox?.height).toBeLessThanOrEqual(width > 820 ? 210 : 310);
    await expect(
      page.getByRole("article", { name: "Python Backend Engineer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "내 커리어 브리핑" }),
    ).toBeVisible();
    await expect(
      page.getByText("채용 시장", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("맞는 공고", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/커리어 이야기 둘러보기|채용 시장 인사이트|내 커리어 인사이트/),
    ).toHaveCount(0);
    await expect(
      page.getByRole("article", { name: "Go Platform Engineer" }),
    ).toHaveCount(0);

    const edit = context.getByRole("link", {
      name: "내 커리어 기준 수정",
    });
    const editBox = await edit.boundingBox();
    expect(editBox?.width).toBeGreaterThanOrEqual(44);
    expect(editBox?.height).toBeGreaterThanOrEqual(44);
    await expect(edit).toHaveCSS("white-space", "nowrap");
    if (width === 320) {
      const tabs = page
        .getByRole("tablist", { name: "피드 보기" })
        .getByRole("tab");
      await expect(tabs).toHaveCount(4);
      for (let index = 0; index < (await tabs.count()); index += 1) {
        const tab = tabs.nth(index);
        await expect(tab).toHaveCSS("white-space", "nowrap");
        const tabBox = await tab.boundingBox();
        expect(tabBox?.width).toBeGreaterThanOrEqual(44);
        expect(tabBox?.height).toBeGreaterThanOrEqual(44);
      }
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    await edit.click();
    await expect(page).toHaveURL(/\/career$/);
    await expect(page.getByLabel("경력 조건")).toHaveValue("experienced");
    await expect(page.getByLabel("희망 기술 분야")).toHaveValue("backend");
    expect(browserErrors).toEqual([]);
  });
}
