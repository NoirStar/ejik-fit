import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390, 320]) {
  test(`searches verified data without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    const pageContent = page.locator("#main-content");
    const guideLink = pageContent
      .getByRole("region", { name: "이직핏 커뮤니티 가이드" })
      .getByRole("link", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요? 예시 읽기",
      });
    await expect(guideLink).toBeVisible();
    const guideLinkBox = await guideLink.boundingBox();
    expect(guideLinkBox?.width).toBeGreaterThanOrEqual(44);
    expect(guideLinkBox?.height).toBeGreaterThanOrEqual(44);

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
    const internalDetailLink = pageContent.getByRole("link", {
      name: "공고 보기",
    });
    await expect(internalDetailLink).toBeVisible();
    await expect(internalDetailLink).toHaveAttribute("href", "/jobs/job-python");
    await expect(internalDetailLink).not.toHaveAttribute("target", "_blank");
    const companyPageLink = pageContent.getByRole("link", {
      name: "기업 채용페이지 보기",
    });
    await expect(companyPageLink).toHaveAttribute(
      "href",
      "https://recruit.navercorp.com/job-python",
    );
    await expect(companyPageLink).toHaveAttribute("target", "_blank");
    await expect(companyPageLink).toHaveAttribute("rel", "noreferrer");
    await expect(
      pageContent.getByText(/필수 \d+ · 우대 \d+ · 미표기 \d+/),
    ).toBeVisible();
    await expect(
      pageContent.getByText(
        "현재 기술 수요 상위 표본에서 이름이 일치한 기술입니다.",
      ),
    ).toBeVisible();
    const unspecifiedHelp = pageContent.getByText(
      "미표기: 공고에서 필수 또는 우대로 구분하지 않은 기술",
    );
    await expect(unspecifiedHelp).toBeVisible();
    const breakdown = pageContent.getByLabel(
      "필수 27건, 우대 8건, 필수·우대 미표기 28건",
    );
    const unspecifiedHelpId = await unspecifiedHelp.getAttribute("id");
    expect(unspecifiedHelpId).not.toBeNull();
    await expect(breakdown).toHaveAttribute(
      "aria-describedby",
      unspecifiedHelpId!,
    );
    await expect(pageContent.getByText(/API/)).toHaveCount(0);

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
      pageContent.getByRole("link", { name: "Python 스킬맵 보기" }),
      internalDetailLink,
      companyPageLink,
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
    const skillMapLink = pageContent.getByRole("link", {
      name: "Python 스킬맵 보기",
    });
    await skillMapLink.focus();
    await expect(skillMapLink).toBeFocused();

    if (width === 320) {
      const scopeLinks = pageContent
        .getByRole("navigation", { name: "검색 범위" })
        .getByRole("link");
      await expect(scopeLinks).toHaveCount(5);
      const noWrapTargets = [pageContent.getByRole("button", { name: "검색" })];
      for (let index = 0; index < (await scopeLinks.count()); index += 1) {
        noWrapTargets.push(scopeLinks.nth(index));
      }
      for (const target of noWrapTargets) {
        expect(
          await target.evaluate(
            (element) => getComputedStyle(element).whiteSpace === "nowrap",
          ),
        ).toBe(true);
      }
    }
  });
}

test("moves between actual result scopes and clearly labeled guidance", async ({
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
  const guide = page.getByRole("region", { name: "커뮤니티 활용 가이드" });
  await expect(
    guide.getByText("활용 가이드는 실제 사용자 글이 아닙니다."),
  ).toBeVisible();
  await expect(
    page.getByText("활용 가이드는 실제 사용자 글이 아닙니다."),
  ).toHaveCount(1);
  await expect(guide.getByText("활용 가이드", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText(/공개 커뮤니티 결과는 서버 전체 글에서 찾습니다/),
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

test("finds a legacy browser post as recovery data after reload", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const query = "로컬 검색";
  const title = "로컬 검색으로 다시 찾는 내 질문";
  const localPostId = "local-search-recovery-question";
  await page.setViewportSize({ height: 900, width: 390 });
  await page.addInitScript(
    ({ id, postTitle, searchQuery }) => {
      localStorage.setItem(
        "ejik-fit:local-community-posts",
        JSON.stringify([
          {
            id,
            category: "커리어 질문",
            title: postTitle,
            body: "실제 공고를 비교한 뒤 이 브라우저에서 복구할 질문입니다.",
            tags: [searchQuery, "이직 준비"],
            createdAt: "2026-07-22T12:00:00.000Z",
          },
        ]),
      );
    },
    { id: localPostId, postTitle: title, searchQuery: query },
  );
  await page.goto(`/search?q=${encodeURIComponent(query)}`);
  await expect(
    page.getByRole("heading", { name: `“${query}” 검색 결과` }),
  ).toBeVisible();

  expect(
    await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem("ejik-fit:local-community-posts") ?? "[]",
      ),
    ),
  ).toHaveLength(1);
  await expect(
    page.getByRole("region", { name: "이전 기기 저장 글" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: title }).getByText("이전 저장 글"),
  ).toBeVisible();

  const globalSearch = page.getByRole("searchbox", { name: "통합 검색" });
  await globalSearch.fill(query);
  await globalSearch.press("Enter");
  await expect(
    page.getByRole("heading", { name: `“${query}” 검색 결과` }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("q")).toBe(query);

  let localResult = page.getByRole("article", { name: title });
  await expect(localResult).toBeVisible();
  await expect(localResult.getByText("이전 저장 글")).toBeVisible();
  await expect(page.getByRole("link", { name: /커뮤니티.*1/ })).toBeVisible();
  await expect(page.getByText("검색 결과가 없습니다.")).toHaveCount(0);
  await expect(
    page.getByText(/이전 저장 글은 이 브라우저에서만 복구할 수 있고/),
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
  await expect(page.getByText("이전 기기 저장 글", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "이 브라우저에 저장된 내 글",
    }),
  ).toBeVisible();
  await expect(page.getByText("예시 콘텐츠")).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
