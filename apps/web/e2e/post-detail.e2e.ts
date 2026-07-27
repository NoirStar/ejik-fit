import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390, 320]) {
  test(`removes built-in community examples at ${width}px`, async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "이직핏 커뮤니티 가이드" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name: "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요? 예시 읽기",
      }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    await page.goto("/posts/career-move-3y-backend");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "페이지를 찾을 수 없습니다.",
      }),
    ).toBeVisible();
    expect(browserErrors).toEqual([]);
  });
}

test("keeps a legacy browser post recovery-only on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 390 });
  await page.goto("/");
  await page.evaluate(() => {
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
  await expect(
    page.getByRole("heading", { level: 2, name: "이 기기에 남은 글" }),
  ).toBeVisible();
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
      page.evaluate(() => localStorage.getItem("ejik-fit:local-community-posts")),
    )
    .toBe("[]");
});

test("keeps a guest draft for login without publishing a local post", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.setViewportSize({ height: 900, width: 390 });
  await page.goto("/?compose=1");

  const title = "로그인 후 올릴 커리어 질문";
  await page.getByLabel("제목").fill(title);
  await page
    .getByLabel("내용")
    .fill("실제 공고 요구 기술을 비교한 뒤 무엇부터 준비할지 궁금합니다.");
  await page.getByLabel("태그 (선택)").fill("이직 준비, 백엔드");
  await page.getByRole("button", { name: "피드에 올리기" }).click();

  await expect(page).toHaveURL(/\/login\?next=%2F%3Fcompose%3Dresume$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "로그인" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        draft: sessionStorage.getItem("ejik-fit:community-draft"),
        localPosts: localStorage.getItem("ejik-fit:local-community-posts"),
      })),
    )
    .toEqual({
      draft: expect.stringContaining(title),
      localPosts: null,
    });
  expect(browserErrors).toEqual([]);
});
