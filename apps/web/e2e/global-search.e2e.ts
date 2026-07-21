import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390]) {
  test(`searches verified data without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    const pageContent = page.locator("#main-content");
    const homeTag = pageContent.getByRole("link", {
      name: "백엔드 커뮤니티 검색",
    }).first();
    const homeTagBox = await homeTag.boundingBox();
    expect(homeTagBox?.width).toBeGreaterThanOrEqual(44);
    expect(homeTagBox?.height).toBeGreaterThanOrEqual(44);

    const globalSearch = page.getByRole("searchbox", { name: "통합 검색" });
    await globalSearch.fill("Python");
    await globalSearch.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=Python$/);
    await expect(
      pageContent.getByRole("heading", { name: "“Python” 검색 결과" }),
    ).toBeVisible();
    await expect(
      pageContent.getByRole("link", { name: "NAVER 기업 채용 현황" }),
    ).toBeVisible();
    await expect(
      pageContent.getByRole("link", { name: "Python Backend Engineer" }),
    ).toBeVisible();
    await expect(
      pageContent.getByRole("link", { name: "Go Platform Engineer" }),
    ).not.toBeVisible();
    await expect(
      pageContent.getByRole("link", { name: "Python 스킬맵 보기" }),
    ).toBeVisible();
    await expect(
      pageContent.getByText("공식 공고", { exact: true }),
    ).toBeVisible();
    await expect(pageContent.getByText("공고 통계 표본")).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    const touchTargets = [
      pageContent.getByRole("button", { name: "검색" }),
      pageContent.getByRole("link", { name: /기업.*1/ }),
      pageContent.getByRole("link", { name: "NAVER 기업 채용 현황" }),
      pageContent.getByRole("link", { name: "Python 스킬맵", exact: true }),
      pageContent.getByRole("link", { name: "NAVER", exact: true }),
    ];
    if (width > 600) {
      touchTargets.push(
        pageContent.getByRole("link", { name: "범위만 보기" }).first(),
      );
    }

    for (const target of touchTargets) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("moves between actual result scopes and clearly labeled starting posts", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/search?q=Kubernetes");

  await page.getByRole("link", { name: /커뮤니티.*1/ }).click();
  await expect(page).toHaveURL(
    "/search?q=Kubernetes&scope=community",
  );
  await expect(
    page.getByRole("link", {
      name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
    }),
  ).toBeVisible();
  await expect(page.getByText("시작 글", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/실제 커뮤니티 글은 최근 공개 글 범위에서 검색합니다/),
  ).toBeVisible();
  const communityTag = page.getByRole("link", {
    name: "Kubernetes 커뮤니티 검색",
  });
  const communityTagBox = await communityTag.boundingBox();
  expect(communityTagBox?.width).toBeGreaterThanOrEqual(44);
  expect(communityTagBox?.height).toBeGreaterThanOrEqual(44);

  await page.getByRole("link", { name: /기술.*1/ }).click();
  await expect(page).toHaveURL("/search?q=Kubernetes&scope=skills");
  await page
    .getByRole("link", { name: "Kubernetes 스킬맵 보기" })
    .click();
  await expect(page).toHaveURL(/\/skill-map\?skill=Kubernetes$/);

  await page.goto("/search?q=Python&scope=companies");
  await page
    .getByRole("link", { name: "NAVER 기업 채용 현황" })
    .click();
  await expect(page).toHaveURL(/\/companies\/naver$/);
  await expect(page.getByRole("heading", { name: "NAVER" })).toBeVisible();
});

test("finds a browser-owned post after reload and opens its local detail", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const query = "로컬 검색";
  const title = "로컬 검색으로 다시 찾는 내 질문";
  await page.setViewportSize({ height: 900, width: 390 });
  await page.goto("/?compose=1");
  await page.getByLabel("제목").fill(title);
  await page
    .getByLabel("내용")
    .fill("실제 공고를 비교한 뒤 이 브라우저에서 다시 찾을 질문입니다.");
  await page.getByLabel("태그 (선택)").fill(`${query}, 이직 준비`);
  await page.getByRole("button", { name: "피드에 올리기" }).click();
  await expect(page.getByRole("article", { name: title })).toBeVisible();

  const localPostId = await page.evaluate(() => {
    const posts = JSON.parse(
      localStorage.getItem("ejik-fit:local-community-posts") ?? "[]",
    );
    return posts[0]?.id as string | undefined;
  });
  expect(localPostId).toMatch(/^local-/);

  const globalSearch = page.getByRole("searchbox", { name: "통합 검색" });
  await globalSearch.fill(query);
  await globalSearch.press("Enter");
  await expect(
    page.getByRole("heading", { name: `“${query}” 검색 결과` }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("q")).toBe(query);

  let localResult = page.getByRole("article", { name: title });
  await expect(localResult).toBeVisible();
  await expect(localResult.getByText("내 로컬 글")).toBeVisible();
  await expect(page.getByRole("link", { name: /커뮤니티.*1/ })).toBeVisible();
  await expect(page.getByText("검색 결과가 없습니다.")).toHaveCount(0);
  await expect(
    page.getByText(/실제 커뮤니티 글은 최근 공개 글 범위에서 검색합니다/),
  ).toBeVisible();

  const resultLink = localResult.getByRole("link", { exact: true, name: title });
  await expect(resultLink).toHaveAttribute("href", `/posts/${localPostId}`);
  const resultLinkBox = await resultLink.boundingBox();
  expect(resultLinkBox?.width).toBeGreaterThanOrEqual(44);
  expect(resultLinkBox?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  await page.reload();
  localResult = page.getByRole("article", { name: title });
  await expect(localResult).toBeVisible();
  await localResult.getByRole("link", { exact: true, name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/posts/${localPostId}$`));
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: title }),
  ).toBeVisible();
  await expect(page.getByText("로컬 글", { exact: true })).toBeVisible();
  await expect(page.getByText("예시 콘텐츠")).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
