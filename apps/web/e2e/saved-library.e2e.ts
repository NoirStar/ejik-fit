import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`keeps actual and mock saved evidence usable at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    await page.addInitScript(() => {
      if (!localStorage.getItem("ejik-fit:saved-job-ids")) {
        localStorage.setItem(
          "ejik-fit:saved-job-ids",
          JSON.stringify(["job-python"]),
        );
      }
      if (!localStorage.getItem("ejik-fit:social-interactions")) {
        localStorage.setItem(
          "ejik-fit:social-interactions",
          JSON.stringify({
            reactedPostIds: [],
            savedPostIds: ["kubernetes-experience"],
            commentsByPostId: {},
          }),
        );
      }
    });
    await page.goto("/career/saved");

    await expect(
      page.getByRole("heading", { level: 1, name: "저장 보관함" }),
    ).toBeVisible();
    const job = page.getByRole("article", {
      name: "Python Backend Engineer",
    });
    await expect(job).toBeVisible();
    await expect(job.getByText("현재 API 재확인")).toBeVisible();
    await expect(job.getByRole("link", { name: "공식 원문" })).toHaveAttribute(
      "href",
      "https://recruit.navercorp.com/job-python",
    );
    await expect(job.locator("img")).toHaveCount(1);

    const community = page.getByRole("article", {
      name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
    });
    await expect(community).toBeVisible();
    await expect(community.getByText("예시 콘텐츠")).toBeVisible();
    await expect(page.getByText(/실제 사용자가 작성한 글이 아닙니다/)).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    for (const target of [
      page.getByRole("tab", { name: "전체 2" }),
      page.getByRole("tab", { name: "공식 공고 1" }),
      page.getByRole("tab", { name: "커뮤니티 예시 1" }),
      job.getByRole("button", { name: "Python Backend Engineer 저장 해제" }),
      community.getByRole("button", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요? 저장 해제",
      }),
      page.getByRole("link", { name: "내 기술 비교" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole("tab", { name: "커뮤니티 예시 1" }).click();
    await expect(job).not.toBeVisible();
    await expect(community).toBeVisible();
    await page.getByRole("tab", { name: "전체 2" }).click();

    await job
      .getByRole("button", { name: "Python Backend Engineer 저장 해제" })
      .click();
    await expect(job).not.toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("article", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", { name: "Python Backend Engineer" }),
    ).not.toBeVisible();
    await expect(page.getByRole("tab", { name: "공식 공고 0" })).toBeVisible();
    expect(browserErrors).toEqual([]);
  });
}

test("opens the saved library from the user utility menu", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");

  await page.getByRole("button", { name: "사용자 메뉴 열기" }).click();
  await page
    .locator('[aria-label="사용자 메뉴"]')
    .getByRole("link", { name: "저장 보관함" })
    .click();

  await expect(page).toHaveURL("/career/saved");
  await expect(
    page.getByRole("heading", { level: 2, name: "아직 저장한 항목이 없습니다." }),
  ).toBeVisible();
});
