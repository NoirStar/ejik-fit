import { expect, test } from "@playwright/test";

import {
  resetCommunityFixture,
  signInCommunityViewer,
} from "./fixtures/community-auth";

test("keeps an account-authored question available after reload and safely deletes it", async ({
  page,
  request,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await resetCommunityFixture(request);
  try {
    const title = "내 질문 보관함에서 다시 보는 커리어 고민";
    await page.setViewportSize({ height: 900, width: 390 });
    await signInCommunityViewer(page, "/?compose=1");

    const composer = page.getByRole("dialog", { name: "커뮤니티 글쓰기" });
    await composer.getByText("커리어 고민", { exact: true }).click();
    await composer.getByLabel("제목").fill(title);
    await composer
      .getByLabel("내용")
      .fill("실제 공고의 필수 기술을 비교한 뒤 준비 순서를 묻는 질문입니다.");
    await composer.getByLabel("태그 (선택)").fill("Kubernetes, 이직 준비");
    await composer.getByRole("button", { name: "피드에 올리기" }).click();
    await expect(page.getByRole("article", { name: title })).toBeVisible();

    await page.getByRole("button", { name: "사용자 메뉴 열기" }).click();
    await page
      .getByLabel("사용자 메뉴")
      .getByRole("link", { name: "내 글" })
      .click();
    await expect(page).toHaveURL(/\/career\/questions$/);

    let question = page.getByRole("article", { name: title });
    await expect(question).toBeVisible();
    await expect(page.getByText("계정 글 1개")).toBeVisible();
    await expect(question.getByText("커리어 고민 · 계정에 작성")).toBeVisible();
    await expect(question.getByText("Kubernetes")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "이전 기기 저장 글" }),
    ).toHaveCount(0);

    await page.reload();
    question = page.getByRole("article", { name: title });
    await expect(question).toBeVisible();

    await question.getByRole("link", { name: title }).click();
    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: title }),
    ).toBeVisible();
    await page.goBack();
    question = page.getByRole("article", { name: title });
    await expect(question).toBeVisible();

    const deleteButton = question.getByRole("button", {
      name: `${title} 삭제`,
    });
    const deleteButtonBox = await deleteButton.boundingBox();
    expect(deleteButtonBox?.width).toBeGreaterThanOrEqual(44);
    expect(deleteButtonBox?.height).toBeGreaterThanOrEqual(44);
    await deleteButton.click();
    await expect(
      question.getByText("삭제하면 글에 남아 있는 댓글과 반응도 함께 지워집니다."),
    ).toBeVisible();
    await question.getByRole("button", { name: "정말 삭제" }).click();

    await expect(question).not.toBeVisible();
    await expect(
      page.getByText("작성한 글이 없습니다."),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: "글쓰기" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("ejik-fit:local-community-posts") ?? "[]",
        ),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(browserErrors).toEqual([]);
  } finally {
    await resetCommunityFixture(request);
  }
});
