import { expect, test } from "@playwright/test";

test("keeps a browser-authored question findable through detail and safe deletion", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const title = "내 질문 보관함에서 다시 보는 커리어 고민";
  await page.setViewportSize({ height: 900, width: 390 });
  await page.goto("/career/questions");
  await expect(
    page.getByText("이 브라우저에서 작성한 글이 없습니다."),
  ).toBeVisible();

  const emptyCta = page.getByRole("link", { name: "첫 글 작성" });
  const emptyCtaBox = await emptyCta.boundingBox();
  expect(emptyCtaBox?.width).toBeGreaterThanOrEqual(44);
  expect(emptyCtaBox?.height).toBeGreaterThanOrEqual(44);
  await emptyCta.click();

  await expect(page).toHaveURL(/\/?\?compose=1$/);
  await page
    .getByRole("dialog")
    .getByText("커리어 고민", { exact: true })
    .click();
  await page.getByLabel("제목").fill(title);
  await page
    .getByLabel("내용")
    .fill("실제 공고의 필수 기술을 비교한 뒤 준비 순서를 묻는 질문입니다.");
  await page.getByLabel("태그 (선택)").fill("Kubernetes, 이직 준비");
  await page.getByRole("button", { name: "피드에 올리기" }).click();
  await expect(page.getByRole("article", { name: title })).toBeVisible();

  await page.getByRole("button", { name: "사용자 메뉴 열기" }).click();
  await page.getByLabel("사용자 메뉴").getByRole("link", { name: "내 글" }).click();
  await expect(page).toHaveURL(/\/career\/questions$/);

  let question = page.getByRole("article", { name: title });
  await expect(question).toBeVisible();
  await expect(page.getByText("이 브라우저에 1개 저장")).toBeVisible();
  await expect(
    question.getByText("커리어 고민 · 이 브라우저에서 작성"),
  ).toBeVisible();
  await expect(question.getByText("Kubernetes")).toBeVisible();
  await page.reload();
  question = page.getByRole("article", { name: title });
  await expect(question).toBeVisible();

  const titleLink = question.getByRole("link", { name: title });
  await titleLink.click();
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
    question.getByText("삭제하면 댓글과 반응도 함께 지워집니다."),
  ).toBeVisible();
  await question.getByRole("button", { name: "정말 삭제" }).click();

  await expect(question).not.toBeVisible();
  await expect(
    page.getByText("이 브라우저에서 작성한 글이 없습니다."),
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
});
