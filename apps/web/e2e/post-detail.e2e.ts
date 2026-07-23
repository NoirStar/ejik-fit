import { expect, test } from "@playwright/test";

const postTitle = "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?";

for (const width of [1440, 820, 390, 320]) {
  test(`keeps starter guidance clearly read-only at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    await page.goto("/");
    const guide = page.getByRole("region", {
      name: "이직핏 커뮤니티 가이드",
    });
    await guide
      .getByRole("link", { name: `${postTitle} 예시 읽기` })
      .click();

    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: postTitle }),
    ).toBeVisible();
    if (width === 1440) {
      const title = page.getByRole("heading", {
        exact: true,
        level: 1,
        name: postTitle,
      });
      const titleBox = await title.boundingBox();
      const lineHeight = await title.evaluate((element) =>
        parseFloat(getComputedStyle(element).lineHeight),
      );
      expect(titleBox?.height).toBeLessThanOrEqual(lineHeight * 1.1);
    }
    await expect(
      page.getByText("이직핏 커뮤니티 가이드", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "이 글 안내" }),
    ).toContainText("실제 회원이 작성한 게시물이 아닌 읽기 전용 예시");
    await expect(
      page.getByRole("navigation", { name: "관련 글" }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "이 글 안내" }),
    ).toContainText("실제 커뮤니티 활동에는 포함되지 않습니다");

    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /공감|저장|팔로우|댓글 등록/ }),
    ).toHaveCount(0);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    const back = page.getByRole("link", { name: "홈 피드로 돌아가기" });
    const related = page
      .getByRole("navigation", { name: "관련 글" })
      .getByRole("link")
      .first();
    for (const target of [back, related]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    if (width === 320) {
      await expect(back).toHaveCSS("white-space", "nowrap");
    }

    await page.reload();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /공감|저장|팔로우|댓글 등록/ }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: "홈 피드로 돌아가기" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expect(
      page
        .getByRole("tabpanel")
        .getByRole("article", { name: new RegExp(postTitle) }),
    ).toHaveCount(0);
    const homeGuide = page.getByRole("region", {
      name: "이직핏 커뮤니티 가이드",
    });
    await expect(homeGuide).toContainText("읽기 전용");

    if (width <= 390) {
      await homeGuide
        .getByRole("link", { name: `${postTitle} 예시 읽기` })
        .click();
      await expect(
        page.getByRole("heading", { exact: true, level: 1, name: postTitle }),
      ).toBeVisible();
      const navigation = page.getByRole("navigation", {
        name: "모바일 주요 탐색",
      });
      await expect(navigation).toBeVisible();
      const navigationBox = await navigation.boundingBox();
      const mainPaddingBottom = await page
        .locator("main")
        .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
      expect(mainPaddingBottom).toBeGreaterThanOrEqual(navigationBox?.height ?? 0);
    }

    expect(browserErrors).toEqual([]);
  });
}

test("builds recent topics only from details viewed in this browser", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const kubernetesTitle =
    "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?";
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");

  let recent = page.getByRole("region", { name: "최근 본 주제" });
  await expect(recent).toHaveCount(0);

  let guide = page.getByRole("region", {
    name: "이직핏 커뮤니티 가이드",
  });
  await guide
    .getByRole("link", { name: `${postTitle} 예시 읽기` })
    .click();
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: postTitle }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("ejik-fit:recent-community-topics"),
      ),
    )
    .toContain("career-move-3y-backend");
  await page.getByRole("link", { name: "홈 피드로 돌아가기" }).click();

  recent = page.getByRole("region", { name: "최근 본 주제" });
  await expect(
    recent.getByRole("link", {
      name: `백엔드: ${postTitle} 다시 보기`,
    }),
  ).toHaveAttribute("href", "/posts/career-move-3y-backend");

  guide = page.getByRole("region", { name: "이직핏 커뮤니티 가이드" });
  await guide
    .getByRole("link", { name: `${kubernetesTitle} 예시 읽기` })
    .click();
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: kubernetesTitle,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "홈 피드로 돌아가기" }).click();

  recent = page.getByRole("region", { name: "최근 본 주제" });
  let recentLinks = recent.getByRole("link", { name: /다시 보기/ });
  await expect(recentLinks).toHaveCount(2);
  await expect(recentLinks.nth(0)).toHaveAttribute(
    "href",
    "/posts/kubernetes-experience",
  );
  await expect(recentLinks.nth(1)).toHaveAttribute(
    "href",
    "/posts/career-move-3y-backend",
  );

  await page.reload();
  recent = page.getByRole("region", { name: "최근 본 주제" });
  recentLinks = recent.getByRole("link", { name: /다시 보기/ });
  await expect(recentLinks).toHaveCount(2);
  const recentLinkBox = await recentLinks.nth(0).boundingBox();
  expect(recentLinkBox?.width).toBeGreaterThanOrEqual(44);
  expect(recentLinkBox?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  await recentLinks.nth(0).click();
  await expect(page).toHaveURL(/\/posts\/kubernetes-experience$/);
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: kubernetesTitle,
    }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

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

  await expect(page).toHaveURL(
    /\/login\?next=%2F%3Fcompose%3Dresume$/,
  );
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
