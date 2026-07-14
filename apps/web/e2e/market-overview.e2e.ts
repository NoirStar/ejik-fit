import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390]) {
  test(`keeps market category evidence and controls usable at ${width}px`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.setViewportSize({ height: width === 390 ? 844 : 900, width });
    await page.goto("/market?category=infra&career_type=experienced");

    const title = page.getByRole("heading", { level: 1, name: "채용 시장" });
    await expect(title).toBeVisible();
    expect(
      await title.evaluate((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      ),
    ).toBeLessThanOrEqual(34);
    await expect(page.getByRole("link", { exact: true, name: "인프라" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("link", { exact: true, name: "경력" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText(/인프라 기술이 확인된 공개 공고/)).toBeVisible();
    await expect(
      page.getByText("확인 공고", { exact: true }).locator(".."),
    ).toContainText("1건");
    await expect(page.getByRole("link", { name: "Docker 스킬맵" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Python 스킬맵" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kubernetes 스킬맵" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go 스킬맵" })).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Python 관련 공고" }),
    ).toHaveAttribute(
      "href",
      "/jobs?q=Python&category=infra&career_type=experienced",
    );

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(consoleErrors).toEqual([]);

    if (width <= 839) {
      expect(
        await title.evaluate((element) =>
          parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeLessThanOrEqual(28);

      const categoryFilters = page.getByRole("navigation", {
        name: "기술 분야",
      });
      const careerFilters = page.getByRole("navigation", {
        name: "경력 조건",
      });

      await expect(categoryFilters).toHaveCSS("flex-wrap", "nowrap");
      await expect(categoryFilters).toHaveCSS("overflow-x", "auto");
      expect(
        await categoryFilters.evaluate((element) => element.scrollHeight),
      ).toBeLessThanOrEqual(46);
      expect(
        await careerFilters.evaluate((element) => element.scrollHeight),
      ).toBeLessThanOrEqual(46);
      await expect(
        page.getByText("확인 기술", { exact: true }).locator(".."),
      ).toBeInViewport();

      const firstSkillRow = await page
        .getByRole("link", { name: "Docker 스킬맵" })
        .evaluate((element) => {
          const row = element.closest("li")?.getBoundingClientRect();
          return row ? { bottom: row.bottom, top: row.top } : null;
        });
      const navigationBox = await page
        .getByRole("navigation", { name: "모바일 주요 탐색" })
        .boundingBox();

      expect(firstSkillRow).not.toBeNull();
      expect(navigationBox).not.toBeNull();
      expect(firstSkillRow!.top).toBeGreaterThanOrEqual(0);
      expect(firstSkillRow!.bottom).toBeLessThanOrEqual(navigationBox!.y);
    }

    for (const target of [
      page.getByRole("link", { exact: true, name: "언어" }),
      page.getByRole("link", { exact: true, name: "경력" }),
      page.getByRole("link", { name: "Python 스킬맵" }),
      page.getByRole("link", { name: "Python 관련 공고" }),
      page
        .getByLabel("데이터를 읽는 기준")
        .getByRole("link", { name: "분석 방법" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("carries market category and career into the jobs explorer", async ({
  page,
}) => {
  await page.goto("/market?category=infra&career_type=experienced");
  await page.getByRole("link", { name: "조건에 맞는 전체 공고" }).click();

  await expect(page).toHaveURL(
    /\/jobs\?category=infra&career_type=experienced$/,
  );
  await expect(page.getByLabel("기술 분야")).toHaveValue("infra");
  await expect(page.getByLabel("경력 조건")).toHaveValue("experienced");
  await expect(page.getByText("현재 결과 1건")).toBeVisible();
});
