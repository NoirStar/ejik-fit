import { expect, test } from "@playwright/test";

import {
  resetCommunityFixture,
  signInCommunityViewer,
} from "./fixtures/community-auth";

for (const width of [1440, 820, 390, 320]) {
  test(`keeps official jobs usable and ignores retired starter saves at ${width}px`, async ({
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
      page.getByRole("heading", { level: 1, name: "저장 목록" }),
    ).toBeVisible();
    const job = page.getByRole("article", {
      name: "Python Backend Engineer",
    });
    await expect(job).toBeVisible();
    await expect(job.getByText("최근 확인")).toBeVisible();
    await expect(job.getByRole("link", { name: "공식 원문" })).toHaveAttribute(
      "href",
      "https://recruit.navercorp.com/job-python",
    );
    await expect(job.locator("img")).toHaveCount(1);
    const stageSelect = job.getByRole("combobox", {
      name: "Python Backend Engineer 지원 단계",
    });
    await expect(stageSelect).toHaveValue("");

    const community = page.getByRole("article", {
      name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
    });
    await expect(community).toHaveCount(0);
    await expect(page.getByText("시작 글", { exact: true })).toHaveCount(0);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    for (const target of [
      page.getByRole("tab", { name: "전체 1" }),
      page.getByRole("tab", { name: "공식 공고 1" }),
      page.getByRole("tab", { name: "지원 관리 0" }),
      page.getByRole("tab", { name: "커뮤니티 0" }),
      stageSelect,
      job.getByRole("button", { name: "Python Backend Engineer 저장 해제" }),
      page.getByRole("link", { name: "내 기술 비교" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    if (width === 320) {
      const primaryAction = page.getByRole("link", { name: "내 기술 비교" });
      expect(
        await primaryAction.evaluate(
          (element) => getComputedStyle(element).whiteSpace,
        ),
      ).toBe("nowrap");
    }

    await stageSelect.selectOption("interview");
    await expect(stageSelect).toHaveValue("interview");
    await expect(page.getByRole("tab", { name: "지원 관리 1" })).toBeVisible();
    await page.getByRole("tab", { name: "지원 관리 1" }).click();
    await expect(job).toBeVisible();
    await expect(community).not.toBeVisible();
    await page.reload();
    await expect(job).toBeVisible();
    await expect(
      job.getByRole("combobox", {
        name: "Python Backend Engineer 지원 단계",
      }),
    ).toHaveValue("interview");

    await page.getByRole("tab", { name: "커뮤니티 0" }).click();
    await expect(job).not.toBeVisible();
    await expect(
      page.getByText("로그인하면 계정에 저장한 글을 볼 수 있습니다."),
    ).toBeVisible();
    await page.getByRole("tab", { name: "전체 1" }).click();

    await job
      .getByRole("button", { name: "Python Backend Engineer 저장 해제" })
      .click();
    await expect(job).not.toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 2, name: "저장한 항목이 없습니다." }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", { name: "Python Backend Engineer" }),
    ).not.toBeVisible();
    await expect(page.getByRole("tab", { name: "공식 공고 0" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "지원 관리 0" })).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("ejik-fit:job-application-stages"),
      ),
    ).toBe("{}");
    expect(browserErrors).toEqual([]);
  });
}

test("keeps a saved account post connected to its detail on mobile", async ({
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
    const title = "저장 보관함에서 다시 볼 내 질문";
    await page.setViewportSize({ height: 900, width: 390 });
    await signInCommunityViewer(page, "/?compose=1");

    const composer = page.getByRole("dialog", { name: "커뮤니티 글쓰기" });
    await composer.getByLabel("제목").fill(title);
    await composer
      .getByLabel("내용")
      .fill("공식 공고에서 반복되는 기술을 확인한 뒤 남기는 질문입니다.");
    await composer.getByLabel("태그 (선택)").fill("백엔드, 이직 준비");
    await composer.getByRole("button", { name: "피드에 올리기" }).click();

    const homeCard = page.getByRole("article", { name: title });
    await expect(homeCard).toBeVisible();
    await homeCard.getByRole("button", { name: `${title} 저장` }).click();
    await expect(
      homeCard.getByRole("button", { name: `${title} 저장 해제` }),
    ).toHaveAttribute("aria-pressed", "true");
    const detailHref = await homeCard
      .getByRole("link", { exact: true, name: title })
      .getAttribute("href");
    expect(detailHref).toMatch(/^\/posts\/[0-9a-f-]{36}$/);

    await page.goto("/career/saved");
    let savedCard = page.getByRole("article", { name: title });
    await expect(savedCard).toBeVisible();
    await expect(
      savedCard.getByText("계정에 저장됨", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "커뮤니티 1" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "이전 기기 저장 글" }),
    ).toHaveCount(0);
    await expect(
      savedCard.getByRole("link", { exact: true, name: title }),
    ).toHaveAttribute("href", detailHref!);

    for (const target of [
      page.getByRole("tab", { name: "커뮤니티 1" }),
      savedCard.getByRole("link", { exact: true, name: title }),
      savedCard.getByRole("button", { name: `${title} 저장 해제` }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    await page.reload();
    savedCard = page.getByRole("article", { name: title });
    await expect(savedCard).toBeVisible();
    await savedCard.getByRole("link", { exact: true, name: title }).click();
    await expect(page).toHaveURL(new RegExp(`${detailHref}$`));
    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: title }),
    ).toBeVisible();

    await page.goto("/career/saved");
    await page
      .getByRole("article", { name: title })
      .getByRole("button", { name: `${title} 저장 해제` })
      .click();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "저장한 항목이 없습니다.",
      }),
    ).toBeVisible();
    await page.goto("/");
    const restoredHomeCard = page.getByRole("article", { name: title });
    await expect(restoredHomeCard).toBeVisible();
    await expect(
      restoredHomeCard.getByRole("button", { name: `${title} 저장` }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(browserErrors).toEqual([]);
  } finally {
    await resetCommunityFixture(request);
  }
});

test("opens the saved library from the user utility menu", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");

  await page.getByRole("button", { name: "사용자 메뉴 열기" }).click();
  await page
    .locator('[aria-label="사용자 메뉴"]')
    .getByRole("link", { name: "저장 목록" })
    .click();

  await expect(page).toHaveURL("/career/saved");
  await expect(
    page.getByRole("heading", { level: 2, name: "저장한 항목이 없습니다." }),
  ).toBeVisible();
});
