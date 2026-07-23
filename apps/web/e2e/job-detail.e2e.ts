import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 600, 390]) {
  test(`keeps verified job detail usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: width === 390 ? 844 : 900, width });
    if (width === 390) {
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setSafeAreaInsetsOverride", {
        insets: { bottom: 34, left: 0, right: 0, top: 0 },
      });
    }
    await page.addInitScript(() => {
      localStorage.setItem(
        "ejik-fit:owned-skills",
        JSON.stringify(["Python"]),
      );
    });

    await page.goto("/jobs");
    await page
      .getByRole("link", { name: "Python Backend Engineer" })
      .click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Python Backend Engineer",
      }),
    ).toBeVisible();
    await expect(page.getByText("내 기술과 겹침 1개")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "주요 업무" }),
    ).toBeVisible();
    await expect(page.getByText("Do not render this HTML")).toHaveCount(0);

    const title = page.getByRole("heading", {
      level: 1,
      name: "Python Backend Engineer",
    });
    const titleSize = await title.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(titleSize).toBeLessThanOrEqual(width <= 680 ? 28 : 34);
    expect(
      await title.evaluate((element) => getComputedStyle(element).wordBreak),
    ).toBe("keep-all");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    const apply = page.getByRole("link", {
      name: "공식 채용페이지에서 지원",
    });
    const save = page.getByRole("button", {
      name: "Python Backend Engineer 저장",
    });
    for (const target of [apply, save]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    if (width <= 680) {
      const factColumns = await page
        .getByRole("heading", { name: "채용 조건" })
        .locator("+ dl")
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      expect(factColumns.split(" ")).toHaveLength(2);
    }

    await save.click();
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Python Backend Engineer 저장 해제",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    if (width <= 839) {
      const actions = page.getByRole("region", { name: "지원 준비" });
      const primaryActions = page.getByRole("group", { name: "지원 및 저장" });
      const facts = page.getByRole("heading", { name: "채용 조건" });
      const skills = page.getByRole("heading", { name: "기술 요건" });
      const trust = page.getByRole("region", { name: "공고 신뢰 정보" });
      const navigation = page.getByRole("navigation", {
        name: "모바일 주요 탐색",
      });
      await expect(actions).toBeVisible();
      await expect(navigation).toBeVisible();
      const actionsBox = await primaryActions.boundingBox();
      const factsBox = await facts.boundingBox();
      const skillsBox = await skills.boundingBox();
      const trustBox = await trust.boundingBox();
      expect(actionsBox).not.toBeNull();
      expect(factsBox).not.toBeNull();
      expect(skillsBox).not.toBeNull();
      expect(trustBox).not.toBeNull();
      expect(factsBox!.y).toBeLessThan(skillsBox!.y);
      expect(skillsBox!.y).toBeLessThan(trustBox!.y);
      expect(
        await primaryActions.evaluate(
          (element) => getComputedStyle(element).position,
        ),
      ).toBe("fixed");
      const navigationBox = await navigation.boundingBox();
      expect(navigationBox).not.toBeNull();
      expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(
        navigationBox!.y + 1,
      );
      const currentMain = page
        .locator("#main-content")
        .getByRole("main")
        .filter({ visible: true });
      await expect(currentMain).toHaveCount(1);
      const mainPaddingBottom = await currentMain
        .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
      expect(mainPaddingBottom).toBeGreaterThanOrEqual(
        navigationBox!.height + actionsBox!.height,
      );

      const savedButton = page.getByRole("button", {
        name: "Python Backend Engineer 저장 해제",
      });
      for (const target of [apply, savedButton]) {
        expect(
          await target.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const hit = document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2,
            );
            return hit === element || element.contains(hit);
          }),
        ).toBe(true);
      }
    }
  });
}

test("keeps a long Korean job title grouped by words on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 320 });
  await page.goto("/jobs/job-korean");

  const title = page.getByRole("heading", {
    level: 1,
    name: "플랫폼 데이터 서비스 개발자 채용",
  });
  await expect(title).toBeVisible();
  const apply = page.getByRole("link", {
    name: "공식 채용페이지에서 지원",
  });
  await expect(apply).toBeVisible();
  const save = page.getByRole("button", {
    name: "플랫폼 데이터 서비스 개발자 채용 저장",
  });
  await expect(save).toBeVisible();
  const backLink = page.getByRole("link", {
    name: "채용공고로 돌아가기",
  });
  await expect(backLink).toHaveAttribute("href", "/jobs");
  await expect(backLink).not.toHaveAttribute("target", "_blank");
  const companyPageLink = page
    .getByRole("region", { name: "공고 신뢰 정보" })
    .getByRole("link", { name: "기업 채용페이지 보기" });
  await expect(companyPageLink).toHaveAttribute(
    "href",
    "https://recruit.navercorp.com/job-korean",
  );
  await expect(companyPageLink).toHaveAttribute("target", "_blank");
  await expect(companyPageLink).toHaveAttribute("rel", "noreferrer");
  expect(
    await apply.evaluate(
      (element) => getComputedStyle(element).whiteSpace === "nowrap",
    ),
  ).toBe(true);
  const [applyBox, saveBox] = await Promise.all([
    apply.boundingBox(),
    save.boundingBox(),
  ]);
  expect(applyBox).not.toBeNull();
  expect(saveBox).not.toBeNull();
  for (const box of [applyBox!, saveBox!]) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const ctasOverlap =
    applyBox!.x < saveBox!.x + saveBox!.width &&
    applyBox!.x + applyBox!.width > saveBox!.x &&
    applyBox!.y < saveBox!.y + saveBox!.height &&
    applyBox!.y + applyBox!.height > saveBox!.y;
  expect(ctasOverlap).toBe(false);
  expect(
    await title.evaluate((element) => getComputedStyle(element).wordBreak),
  ).toBe("keep-all");

  const charactersPerLine = await title.evaluate((element) => {
    const node = element.firstChild;
    if (!(node instanceof Text)) return [];
    const lines = new Map<number, number>();
    Array.from(node.data).forEach((character, index) => {
      if (/\s/.test(character)) return;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const top = Math.round(range.getBoundingClientRect().top);
      lines.set(top, (lines.get(top) ?? 0) + 1);
    });
    return [...lines.values()];
  });

  expect(charactersPerLine.length).toBeGreaterThan(1);
  expect(charactersPerLine.every((count) => count >= 2)).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
