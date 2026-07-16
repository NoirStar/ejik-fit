import { expect, test } from "@playwright/test";

test("keeps fixture graph scope aligned with the production API contract", async ({
  request,
}) => {
  const unseededResponse = await request.get(
    "http://127.0.0.1:8011/api/graph/skills?limit=30",
  );
  const unknownResponse = await request.get(
    "http://127.0.0.1:8011/api/graph/skills?seed=UnknownSkill&limit=30",
  );
  const fitResponse = await request.post(
    "http://127.0.0.1:8011/api/fit/analyze",
    { data: { owned_skills: ["Rust"] } },
  );
  const unseeded = await unseededResponse.json();
  const unknown = await unknownResponse.json();
  const fit = await fitResponse.json();

  expect(unseeded.seed).toBeNull();
  expect(unseeded.evidence).toHaveLength(2);
  expect(unseeded.nodes.map((node: { id: string }) => node.id)).toContain("Go");
  expect(unknown.seed).toBe("UnknownSkill");
  expect(unknown.edges).toEqual([]);
  expect(unknown.evidence).toEqual([]);
  expect(fitResponse.status()).toBe(200);
  expect(fit).toEqual({
    coverage: {
      matching_posting_count: 17,
      strong_fit_posting_count: 6,
    },
    domain_branches: [],
    recommended_next_skills: [
      {
        skill: "Kubernetes",
        reason: "보유 스킬과 함께 등장한 공고에서 10회 부족 요구사항으로 확인됨",
        required_count: 8,
        preferred_count: 3,
        supporting_posting_count: 10,
      },
    ],
  });
});

for (const width of [1440, 820, 390]) {
  test(`keeps the evidence-led skill map usable at ${width}px`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ height: 900, width });
    const session = await page.context().newCDPSession(page);
    if (width === 390) {
      await session.send("Emulation.setSafeAreaInsetsOverride", {
        insets: { bottom: 34, left: 0, right: 0, top: 0 },
      });
    }
    await page.goto("/skill-map?skill=Kubernetes");

    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /viewport-fit=cover/,
    );

    await expect(page).toHaveURL(/\/skills\/graph\?seed=Kubernetes$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "이직핏 기술 맵" }),
    ).toBeVisible();

    const productNavigation = page.getByRole("navigation", {
      name: width <= 820 ? "모바일 주요 탐색" : "주요 탐색",
    });
    await expect(
      productNavigation.getByRole("link", { name: "스킬맵" }),
    ).toHaveAttribute("aria-current", "page");

    const inspector = page.getByRole("complementary", {
      name: "선택 기술 분석",
    });
    await expect(
      inspector.getByRole("heading", { name: "Kubernetes" }),
    ).toBeVisible();
    await expect(inspector.getByText("1건", { exact: true }).first()).toBeVisible();
    await expect(
      inspector.getByRole("link", { name: /Python Backend Engineer/ }),
    ).toHaveAttribute("href", "/jobs/job-python");

    const quickSkills = page.getByRole("navigation", {
      name: "빠른 기술 선택",
    });
    await quickSkills.getByRole("link", { name: "Docker" }).click();
    await expect(page).toHaveURL(/\/skills\/graph\?seed=Docker$/, {
      timeout: 15_000,
    });
    await expect(
      inspector.getByRole("heading", { name: "Docker" }),
    ).toBeVisible();
    await expect(
      inspector.getByText("언급 공고").locator("..").getByText("2건"),
    ).toBeVisible();
    await expect(
      inspector.getByRole("link", { name: /Go Platform Engineer/ }),
    ).toHaveAttribute("href", "/jobs/job-go");

    const graphFrame = page.getByTestId("skill-graph-frame");
    const graphBox = await graphFrame.boundingBox();
    expect(graphBox?.height).toBeGreaterThanOrEqual(width <= 640 ? 400 : 496);
    const forceCanvas = graphFrame.locator(".force-canvas");
    await expect(forceCanvas).toHaveClass(/force-canvas--ready/);
    await expect(forceCanvas.locator("canvas")).toBeVisible();
    await expect(
      graphFrame.getByRole("group", { name: "그래프 보기 조절" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    if (width <= 900) {
      const disclosure = page.locator("details").filter({
        hasText: "내 스택과 필터",
      });
      await expect(disclosure).not.toHaveAttribute("open", "");
      await disclosure.locator("summary").click();
      await expect(page.getByLabel("스킬 추가")).toBeVisible();

      if (width === 390) {
        await page.getByLabel("스킬 추가").fill("Rust");
        await page.getByRole("button", { name: "추가" }).click();

        for (const target of [
          page.getByRole("button", { name: "Rust 제거" }),
          page.getByRole("button", { name: "초기화" }),
          page.getByRole("button", { name: "선택 주변" }),
          page.getByText("공고 근거 노드", { exact: true }).locator(".."),
          page.getByRole("button", { name: /클라우드/ }),
        ]) {
          const box = await target.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }
      }
    }

    if (width === 390) {
      const mobileNavigation = page.getByRole("navigation", {
        name: "모바일 주요 탐색",
      });
      await expect(mobileNavigation).toBeVisible();
      await graphFrame.evaluate((element) =>
        element.scrollIntoView({ block: "end" }),
      );
      const mobileNavigationBox = await mobileNavigation.boundingBox();
      expect(mobileNavigationBox).not.toBeNull();

      for (const overlay of [
        graphFrame.getByRole("group", { name: "그래프 보기 조절" }),
        graphFrame.getByText("이동 · 핀치 확대 · 탭 선택"),
      ]) {
        const overlayBox = await overlay.boundingBox();
        expect(overlayBox).not.toBeNull();
        expect(overlayBox!.y + overlayBox!.height).toBeLessThanOrEqual(
          mobileNavigationBox!.y,
        );
      }

      const quickTarget = await quickSkills
        .getByRole("link", { name: "Docker" })
        .boundingBox();
      expect(quickTarget?.height).toBeGreaterThanOrEqual(44);

      expect(mobileNavigationBox?.height).toBeGreaterThanOrEqual(102);
      expect(mobileNavigationBox?.y).toBeGreaterThanOrEqual(0);
      expect(
        await page.evaluate(
          () => window.visualViewport?.height ?? window.innerHeight,
        ),
      ).toBeGreaterThanOrEqual(
        (mobileNavigationBox?.y ?? 0) + (mobileNavigationBox?.height ?? 0),
      );
    }

    expect(browserErrors).toEqual([]);
  });
}

test("supports direct graph panning on a touch device", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3102",
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await page.goto("/skills/graph?seed=Kubernetes");

  const graphFrame = page.getByTestId("skill-graph-frame");
  const forceCanvas = graphFrame.locator(".force-canvas");
  await expect(forceCanvas).toHaveClass(/force-canvas--ready/);
  await graphFrame.scrollIntoViewIfNeeded();
  const graphBox = await graphFrame.boundingBox();
  expect(graphBox).not.toBeNull();

  const canvas = forceCanvas.locator("canvas");
  const readZoom = () =>
    canvas.evaluate((element) => {
      const zoom = (
        element as HTMLCanvasElement & {
          __zoom?: { k: number; x: number; y: number };
        }
      ).__zoom;
      return zoom ? { k: zoom.k, x: zoom.x, y: zoom.y } : null;
    });
  const beforePan = await readZoom();
  const x = graphBox!.x + 72;
  const y = graphBox!.y + 72;
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [{ force: 1, id: 1, radiusX: 4, radiusY: 4, x, y }],
    type: "touchStart",
  });
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [
      { force: 1, id: 1, radiusX: 4, radiusY: 4, x: x + 48, y: y + 24 },
    ],
    type: "touchMove",
  });
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [],
    type: "touchEnd",
  });
  await page.waitForTimeout(100);

  const afterPan = await readZoom();
  expect(beforePan).not.toBeNull();
  expect(afterPan?.x).not.toBe(beforePan?.x);

  await graphFrame.getByRole("button", { name: "그래프 확대" }).click();
  await page.waitForTimeout(280);
  expect((await readZoom())?.k).toBeGreaterThan(afterPan?.k ?? 0);
  await context.close();
});
