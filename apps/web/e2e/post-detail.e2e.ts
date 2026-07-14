import { expect, test } from "@playwright/test";

const postTitle = "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?";

for (const width of [1440, 820, 390]) {
  test(`keeps community detail and home interactions synchronized at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    await page.goto("/");
    await page
      .getByRole("tabpanel")
      .getByRole("link", { exact: true, name: postTitle })
      .click();

    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: postTitle }),
    ).toBeVisible();
    await expect(
      page.getByText("커뮤니티 예시 콘텐츠", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "이 글 안내" }),
    ).toContainText("mock 데이터");
    await expect(
      page.getByRole("navigation", { name: "관련 글" }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    const reaction = page.getByRole("button", { name: `${postTitle} 공감` });
    const comments = page.getByRole("link", { name: "댓글 47" });
    const save = page.getByRole("button", { name: `${postTitle} 저장` });
    const follow = page.getByRole("button", { name: "서버정원 팔로우" });
    for (const target of [reaction, comments, save, follow]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await follow.click();
    await reaction.click();
    await save.click();
    await page.getByRole("textbox", { name: "댓글 내용" }).fill("브라우저 회귀 댓글");
    const submitComment = page.getByRole("button", { name: "댓글 등록" });
    expect(
      await submitComment.evaluate((element) => getComputedStyle(element).whiteSpace),
    ).toBe("nowrap");
    await submitComment.click();
    await expect(page.getByRole("status")).toContainText(
      "이 브라우저에 댓글을 저장했습니다.",
    );
    await expect(page.getByText("댓글 48", { exact: true })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("button", { name: "서버정원 팔로우 해제" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: `${postTitle} 공감 취소` }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: `${postTitle} 저장 해제` }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("브라우저 회귀 댓글")).toBeVisible();

    await page.getByRole("link", { name: "홈 피드로 돌아가기" }).click();
    const homeCard = page.getByRole("article", { name: new RegExp(postTitle) });
    await expect(
      homeCard.getByRole("button", { name: `${postTitle} 공감 취소` }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      homeCard.getByRole("button", { name: `${postTitle} 저장 해제` }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      homeCard.getByRole("link", { name: `${postTitle} 댓글 48개` }),
    ).toBeVisible();
    await expect(
      homeCard.getByRole("button", { name: "서버정원 팔로우 해제" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("tab", { name: "팔로잉" }).click();
    await expect(homeCard).toBeVisible();
    await expect(
      page.getByRole("article", {
        name: "Kubernetes을 요구하는 공식 공고를 확인했어요",
      }),
    ).not.toBeVisible();

    if (width === 390) {
      await homeCard
        .getByRole("link", { exact: true, name: postTitle })
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

test("wraps a maximum-length browser comment on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 390 });
  await page.goto("/posts/career-move-3y-backend");
  await page
    .getByRole("textbox", { name: "댓글 내용" })
    .fill("x".repeat(600));
  await page.getByRole("button", { name: "댓글 등록" }).click();

  const localComment = page.locator('[data-local="true"] p');
  await expect(localComment).toBeVisible();
  expect(
    await localComment.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
  ).toBe(true);
});
