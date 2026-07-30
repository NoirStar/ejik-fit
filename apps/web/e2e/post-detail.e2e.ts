import { expect, test } from "@playwright/test";

test("keeps a legacy browser post recovery-only on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 390 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "ejik-fit:local-community-posts",
      JSON.stringify([
        {
          id: "local-e2e-recovery",
          category: "커리어 질문",
          title: "이전 브라우저에 남아 있던 이직 질문",
          body: "서버 게시물이 아니라 계정 이전 또는 삭제만 제공해야 하는 글입니다.",
          tags: ["이직 준비"],
          createdAt: "2026-07-22T09:00:00.000Z",
        },
      ]),
    );
  });
  await page.goto("/posts/local-e2e-recovery");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "이전 브라우저에 남아 있던 이직 질문",
    }),
  ).toBeVisible();
  await expect(page.getByText("이전 기기 저장 글", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /공감|저장|팔로우|댓글 등록/ }),
  ).toHaveCount(0);

  const remove = page.getByRole("button", {
    name: "이전 브라우저에 남아 있던 이직 질문 삭제",
  });
  const removeBox = await remove.boundingBox();
  expect(removeBox?.width).toBeGreaterThanOrEqual(44);
  expect(removeBox?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
  ).toBe(true);

  await remove.click();
  await expect(page.getByRole("status")).toContainText("글을 삭제했습니다");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        current: localStorage.getItem("careerfit:local-community-posts"),
        legacy: localStorage.getItem("ejik-fit:local-community-posts"),
      })),
    )
    .toEqual({ current: "[]", legacy: "[]" });
});

test("keeps a guest community draft for login without publishing a local post", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.setViewportSize({ height: 900, width: 390 });
  await page.goto("/community?compose=1");

  const title = "로그인 후 올릴 커리어 질문";
  await page.getByLabel("제목").fill(title);
  await page
    .getByLabel("내용")
    .fill("실제 채용공고의 업무와 조건을 비교한 뒤 방향을 결정하고 싶습니다.");
  await page.getByLabel("태그 (선택)").fill("이직 준비, 백엔드");
  await page.getByRole("button", { name: "피드에 올리기" }).click();

  await expect(page).toHaveURL(
    /\/login\?next=%2Fcommunity%3Fcompose%3Dresume$/,
  );
  await expect(page.getByRole("heading", { name: "커리어핏 계정" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        currentDraft: sessionStorage.getItem("careerfit:community-draft"),
        legacyDraft: sessionStorage.getItem("ejik-fit:community-draft"),
        currentPosts: localStorage.getItem("careerfit:local-community-posts"),
        legacyPosts: localStorage.getItem("ejik-fit:local-community-posts"),
      })),
    )
    .toEqual({
      currentDraft: expect.stringContaining(title),
      legacyDraft: expect.stringContaining(title),
      currentPosts: null,
      legacyPosts: null,
    });
  expect(browserErrors).toEqual([]);
});
