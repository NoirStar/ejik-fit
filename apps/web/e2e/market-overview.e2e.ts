import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`keeps market category evidence and controls usable at ${width}px`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.setViewportSize({ height: 900, width });
    await page.goto("/market?category=infra&career_type=experienced");

    await expect(
      page.getByRole("heading", { level: 1, name: "채용 시장" }),
    ).toBeVisible();
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

    for (const target of [
      page.getByRole("link", { exact: true, name: "언어" }),
      page.getByRole("link", { exact: true, name: "경력" }),
      page.getByRole("link", { name: "Python 스킬맵" }),
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
