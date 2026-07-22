import { expect, test } from "@playwright/test";

import {
  COMMUNITY_FIXTURE_ORIGIN,
  COMMUNITY_TEST_EMAIL,
  COMMUNITY_TEST_PASSWORD,
  resetCommunityFixture,
  signInCommunityViewer,
} from "./fixtures/community-auth";

const originalTitle = "인증 브라우저 영속성 확인 글";
const updatedTitle = "인증 브라우저 영속성 수정 글";
const searchNeedle = "hermeticneedle0723";
const originalComment = "첫 번째 브라우저 댓글입니다.";
const updatedComment = "수정한 브라우저 댓글입니다.";

test("restores a guest draft after login and publishes only after confirmation", async ({
  page,
  request,
}) => {
  await resetCommunityFixture(request);
  await page.goto("/?compose=1");
  const guestComposer = page.getByRole("dialog", { name: "커뮤니티 글쓰기" });
  await guestComposer.getByLabel("제목").fill("로그인 뒤 확인할 임시 글");
  await guestComposer
    .getByLabel("내용")
    .fill("로그인 전에는 서버 글이 생기지 않아야 합니다.");
  await guestComposer.getByLabel("태그 (선택)").fill("임시 글, 인증");
  await guestComposer.getByRole("button", { name: "피드에 올리기" }).click();

  await expect(page).toHaveURL(/\/login\?next=%2F%3Fcompose%3Dresume$/);
  const beforeLogin = await request.get(
    `${COMMUNITY_FIXTURE_ORIGIN}/rest/v1/community_posts?select=id,title`,
  );
  expect(await beforeLogin.json()).toEqual([]);

  await page.getByLabel("이메일").fill(COMMUNITY_TEST_EMAIL);
  await page.getByLabel("비밀번호").fill(COMMUNITY_TEST_PASSWORD);
  await page.getByRole("button", { exact: true, name: "로그인" }).click();
  await expect(page).toHaveURL(/\/\?compose=resume$/);

  const restoredComposer = page.getByRole("dialog", {
    name: "커뮤니티 글쓰기",
  });
  await expect(restoredComposer.getByLabel("제목")).toHaveValue(
    "로그인 뒤 확인할 임시 글",
  );
  await expect(restoredComposer.getByText("임시 저장된 글을 불러왔습니다.")).toBeVisible();
  const beforeConfirmation = await request.get(
    `${COMMUNITY_FIXTURE_ORIGIN}/rest/v1/community_posts?select=id,title`,
  );
  expect(await beforeConfirmation.json()).toEqual([]);

  await restoredComposer.getByRole("button", { name: "피드에 올리기" }).click();
  await expect(restoredComposer).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "로그인 뒤 확인할 임시 글" }),
  ).toBeVisible();

  await page.reload();
  const article = page.getByRole("article", {
    name: "로그인 뒤 확인할 임시 글",
  });
  await expect(article).toBeVisible();
  await article
    .getByRole("link", { exact: true, name: "로그인 뒤 확인할 임시 글" })
    .click();
  await page.getByRole("button", { name: "이 글 삭제" }).click();
  await page.getByRole("button", { name: "정말 삭제" }).click();
});

test("persists an authenticated post, edits and comments across browser contexts", async ({
  browser,
  page,
  request,
}) => {
  await resetCommunityFixture(request);

  const anonymousWrite = await request.post(
    `${COMMUNITY_FIXTURE_ORIGIN}/rest/v1/community_posts`,
    {
      data: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        author_id: "22222222-2222-4222-8222-222222222222",
        category: "커리어 질문",
        title: "익명 쓰기 시도",
        body: "인증 없이 저장되면 안 됩니다.",
        tags: [],
      },
    },
  );
  expect(anonymousWrite.status()).toBe(403);

  const authResponse = await request.post(
    `${COMMUNITY_FIXTURE_ORIGIN}/auth/v1/token?grant_type=password`,
    {
      data: {
        email: COMMUNITY_TEST_EMAIL,
        password: COMMUNITY_TEST_PASSWORD,
      },
    },
  );
  const fixtureSession = (await authResponse.json()) as { access_token: string };
  const crossUserWrite = await request.post(
    `${COMMUNITY_FIXTURE_ORIGIN}/rest/v1/community_posts`,
    {
      data: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        author_id: "22222222-2222-4222-8222-222222222222",
        category: "커리어 질문",
        title: "다른 사용자 쓰기 시도",
        body: "로그인 사용자와 작성자가 다르면 저장되면 안 됩니다.",
        tags: [],
      },
      headers: { authorization: `Bearer ${fixtureSession.access_token}` },
    },
  );
  expect(crossUserWrite.status()).toBe(403);

  await signInCommunityViewer(page, "/?compose=1");
  const composer = page.getByRole("dialog", { name: "커뮤니티 글쓰기" });
  await composer.getByLabel("제목").fill(originalTitle);
  await composer
    .getByLabel("내용")
    .fill(`새로고침과 다른 브라우저에서도 남아야 합니다. ${searchNeedle}`);
  await composer.getByLabel("태그 (선택)").fill("E2E, 영속성");
  await composer.getByRole("button", { name: "피드에 올리기" }).click();
  await expect(composer).toHaveCount(0);

  const firstArticle = page.getByRole("article", { name: originalTitle });
  await expect(firstArticle).toBeVisible();
  const detailHref = await firstArticle
    .getByRole("link", { exact: true, name: originalTitle })
    .getAttribute("href");
  expect(detailHref).toMatch(/^\/posts\/[0-9a-f-]{36}$/);

  await page.reload();
  await expect(page.getByRole("article", { name: originalTitle })).toBeVisible();

  const secondContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3102",
  });
  const secondPage = await secondContext.newPage();
  try {
    await signInCommunityViewer(secondPage);
    await expect(
      secondPage.getByRole("article", { name: originalTitle }),
    ).toBeVisible();

    await secondPage.goto(detailHref!);
    await secondPage.getByRole("button", { name: "이 글 수정" }).click();
    const editor = secondPage.getByRole("region", { name: "글 수정" });
    await editor.getByLabel("제목").fill(updatedTitle);
    await editor
      .getByLabel("내용")
      .fill(`수정된 본문도 모든 브라우저에서 같아야 합니다. ${searchNeedle}`);
    await editor.getByRole("button", { name: "수정 내용 저장" }).click();
    await expect(
      secondPage.getByRole("status").filter({
        hasText: "글 수정 내용을 서버에 저장했습니다.",
      }),
    ).toBeVisible();
    await expect(
      secondPage.getByRole("heading", { exact: true, level: 1, name: updatedTitle }),
    ).toBeVisible();

    await page.goto(detailHref!);
    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: updatedTitle }),
    ).toBeVisible();

    await secondPage.getByLabel("댓글 내용").fill(originalComment);
    await secondPage.getByRole("button", { name: "댓글 등록" }).click();
    await expect(secondPage.getByText(originalComment)).toBeVisible();

    await secondPage
      .getByRole("button", { name: `${originalComment} 댓글 수정` })
      .click();
    await secondPage.getByLabel("댓글 수정 내용").fill(updatedComment);
    await secondPage.getByRole("button", { name: "수정 저장" }).click();
    await expect(secondPage.getByText(updatedComment)).toBeVisible();

    await secondPage
      .getByRole("button", { name: `${updatedComment} 댓글 삭제` })
      .click();
    await expect(secondPage.getByText(updatedComment)).toHaveCount(0);

    await secondPage.goto(
      `/search?q=${encodeURIComponent(searchNeedle)}&scope=community`,
    );
    await expect(
      secondPage.getByRole("article", { name: updatedTitle }),
    ).toBeVisible();

    await secondPage.goto(detailHref!);
    await secondPage.getByRole("button", { name: "이 글 삭제" }).click();
    await secondPage.getByRole("button", { name: "정말 삭제" }).click();
    await expect(
      secondPage.getByRole("heading", { level: 1, name: "글을 삭제했습니다." }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "글을 찾을 수 없습니다." }),
    ).toBeVisible();
    await secondPage.goto("/");
    await expect(
      secondPage.getByRole("article", { name: updatedTitle }),
    ).toHaveCount(0);
  } finally {
    await secondContext.close();
  }
});
