import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`synchronizes the browser stack with verified home insight at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    let insight = page.getByRole("region", { name: "내 커리어 인사이트" });
    await expect(insight).toContainText(
      "내 스택을 추가하면 현재 공개 공고와 비교할 수 있어요.",
    );

    if (width > 820) {
      await page.getByRole("button", { name: "내 스택 열기" }).click();
      const stack = page.getByRole("dialog", { name: "내 스택" });
      await stack.getByLabel("추가할 기술").fill("Java");
      await stack.getByRole("button", { name: "기술 추가" }).click();
      await stack.getByRole("button", { name: "내 스택 닫기" }).click();
    } else {
      await insight.getByRole("link", { name: "기술 추가하기" }).click();
      await page.getByLabel("추가할 기술").fill("Java");
      await page.getByRole("button", { name: "기술 추가" }).click();
      await page.goto("/");
    }

    await expect(page).toHaveURL(/owned_skills=Java/);
    insight = page.getByRole("region", { name: "내 커리어 인사이트" });
    await expect(insight.getByText("17건", { exact: true })).toBeVisible();
    await expect(insight).toContainText("필수 기술 절반 이상 6건");
    const skillLink = insight.getByRole("link", {
      name: "Kubernetes 근거 보기",
    });
    await expect(skillLink).toHaveAttribute(
      "href",
      "/skill-map?skill=Kubernetes",
    );
    await expect(insight).toContainText("겹치는 공고 10건의 부족 요구사항");
    await expect(insight).toContainText("필수 8 · 우대 3");
    const linkBox = await skillLink.boundingBox();
    expect(linkBox?.width).toBeGreaterThanOrEqual(44);
    expect(linkBox?.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(browserErrors).toEqual([]);
  });
}
