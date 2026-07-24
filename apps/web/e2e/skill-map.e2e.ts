import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from "@playwright/test";

import { GRAPH_CANVAS_COLORS } from "../src/styles/design-tokens";

type CanvasFingerprint = {
  hash: number;
  paintedPixels: number;
};

type CanvasPoint = {
  x: number;
  y: number;
};

type CanvasZoom = {
  k: number;
  x: number;
  y: number;
};

type Rect = CanvasPoint & {
  height: number;
  width: number;
};

function rectanglesOverlap(left: Rect, right: Rect) {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

const neutralNodeRgb = [
  Number.parseInt(GRAPH_CANVAS_COLORS.neutralNode.slice(1, 3), 16),
  Number.parseInt(GRAPH_CANVAS_COLORS.neutralNode.slice(3, 5), 16),
  Number.parseInt(GRAPH_CANVAS_COLORS.neutralNode.slice(5, 7), 16),
] as const;

async function readCanvasFingerprint(
  canvas: Locator,
): Promise<CanvasFingerprint> {
  return canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const context = canvasElement.getContext("2d", {
      willReadFrequently: true,
    });
    if (!context) return { hash: 0, paintedPixels: 0 };
    const pixels = context.getImageData(
      0,
      0,
      canvasElement.width,
      canvasElement.height,
    ).data;
    let hash = 2_166_136_261;
    let paintedPixels = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      const alpha = pixels[index + 3];
      if (alpha > 0) paintedPixels += 1;
      hash ^=
        pixels[index] |
        (pixels[index + 1] << 8) |
        (pixels[index + 2] << 16) |
        (alpha << 24);
      hash = Math.imul(hash, 16_777_619);
    }
    return { hash: hash >>> 0, paintedPixels };
  });
}

async function readCanvasZoom(canvas: Locator): Promise<CanvasZoom | null> {
  return canvas.evaluate((element) => {
    const zoom = (
      element as HTMLCanvasElement & {
        __zoom?: CanvasZoom;
      }
    ).__zoom;
    return zoom ? { k: zoom.k, x: zoom.x, y: zoom.y } : null;
  });
}

async function waitForCanvasStability(canvas: Locator) {
  let lastHash: number | null = null;
  let stableSamples = 0;
  let latest: CanvasFingerprint = { hash: 0, paintedPixels: 0 };

  await expect
    .poll(
      async () => {
        latest = await readCanvasFingerprint(canvas);
        stableSamples =
          latest.paintedPixels > 0 && latest.hash === lastHash
            ? stableSamples + 1
            : 0;
        lastHash = latest.hash;
        return stableSamples;
      },
      { intervals: [100], timeout: 2_000 },
    )
    .toBeGreaterThanOrEqual(2);

  return latest;
}

async function waitForPaintedCanvas(canvas: Locator) {
  await expect
    .poll(async () => (await readCanvasFingerprint(canvas)).paintedPixels)
    .toBeGreaterThan(0);
  return readCanvasFingerprint(canvas);
}

async function waitForZoomStability(canvas: Locator) {
  let lastZoom: CanvasZoom | null = null;
  let stableSamples = 0;

  await expect
    .poll(
      async () => {
        const zoom = await readCanvasZoom(canvas);
        stableSamples =
          zoom &&
          lastZoom &&
          Math.abs(zoom.k - lastZoom.k) < 0.0001 &&
          Math.abs(zoom.x - lastZoom.x) < 0.01 &&
          Math.abs(zoom.y - lastZoom.y) < 0.01
            ? stableSamples + 1
            : 0;
        lastZoom = zoom;
        return stableSamples;
      },
      { intervals: [100], timeout: 2_000 },
    )
    .toBeGreaterThanOrEqual(2);

  return lastZoom;
}

async function dispatchTouchPan(
  session: CDPSession,
  start: CanvasPoint,
) {
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [
      {
        force: 1,
        id: 1,
        radiusX: 4,
        radiusY: 4,
        x: start.x,
        y: start.y,
      },
    ],
    type: "touchStart",
  });
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [
      {
        force: 1,
        id: 1,
        radiusX: 4,
        radiusY: 4,
        x: start.x + 48,
        y: start.y + 24,
      },
    ],
    type: "touchMove",
  });
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [],
    type: "touchEnd",
  });
}

async function dispatchPinch(
  page: Page,
  session: CDPSession,
  center: CanvasPoint,
) {
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [
      {
        force: 1,
        id: 1,
        radiusX: 5,
        radiusY: 5,
        x: center.x - 28,
        y: center.y,
      },
      {
        force: 1,
        id: 2,
        radiusX: 5,
        radiusY: 5,
        x: center.x + 28,
        y: center.y,
      },
    ],
    type: "touchStart",
  });
  for (const distance of [42, 58, 74]) {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [
        {
          force: 1,
          id: 1,
          radiusX: 5,
          radiusY: 5,
          x: center.x - distance,
          y: center.y,
        },
        {
          force: 1,
          id: 2,
          radiusX: 5,
          radiusY: 5,
          x: center.x + distance,
          y: center.y,
        },
      ],
      type: "touchMove",
    });
    await page.waitForTimeout(32);
  }
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [],
    type: "touchEnd",
  });
}

async function findNeutralNodePoints(canvas: Locator) {
  return canvas.evaluate(
    (element, [red, green, blue]) => {
      const canvasElement = element as HTMLCanvasElement;
      const context = canvasElement.getContext("2d", {
        willReadFrequently: true,
      });
      if (!context) return [];
      const pixels = context.getImageData(
        0,
        0,
        canvasElement.width,
        canvasElement.height,
      ).data;
      const rect = canvasElement.getBoundingClientRect();
      const step = 2;
      const gridWidth = Math.ceil(canvasElement.width / step);
      const matchingPixels = new Set<number>();
      for (let y = 0; y < canvasElement.height; y += 2) {
        for (let x = 0; x < canvasElement.width; x += 2) {
          const offset = (y * canvasElement.width + x) * 4;
          if (
            Math.abs(pixels[offset] - red) <= 4 &&
            Math.abs(pixels[offset + 1] - green) <= 4 &&
            Math.abs(pixels[offset + 2] - blue) <= 4 &&
            pixels[offset + 3] >= 180
          ) {
            matchingPixels.add((y / step) * gridWidth + x / step);
          }
        }
      }

      const components: number[][] = [];
      while (matchingPixels.size > 0) {
        const first = matchingPixels.values().next().value;
        if (typeof first !== "number") break;
        matchingPixels.delete(first);
        const stack = [first];
        const component: number[] = [];
        while (stack.length > 0) {
          const current = stack.pop()!;
          component.push(current);
          const x = current % gridWidth;
          const y = Math.floor(current / gridWidth);
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
              if (offsetX === 0 && offsetY === 0) continue;
              const nextX = x + offsetX;
              const nextY = y + offsetY;
              if (nextX < 0 || nextX >= gridWidth || nextY < 0) continue;
              const next = nextY * gridWidth + nextX;
              if (!matchingPixels.delete(next)) continue;
              stack.push(next);
            }
          }
        }
        if (component.length >= 2) {
          components.push(component);
        }
      }
      return components
        .sort((left, right) => right.length - left.length)
        .map((component) => {
          const center = component.reduce(
            (sum, point) => ({
              x: sum.x + (point % gridWidth) * step,
              y: sum.y + Math.floor(point / gridWidth) * step,
            }),
            { x: 0, y: 0 },
          );
          const x = center.x / component.length;
          const y = center.y / component.length;
          return {
            x: rect.left + x * (rect.width / canvasElement.width),
            y: rect.top + y * (rect.height / canvasElement.height),
          };
        });
    },
    neutralNodeRgb,
  );
}

async function tapSkillNode(
  page: Page,
  session: CDPSession,
  canvas: Locator,
) {
  let point: CanvasPoint | null = null;
  let selectedSkill: string | null = null;
  const selectableBackendSkills = ["Docker", "Go", "Linux", "Python"];
  const tooltip = canvas.locator("xpath=..").locator(".float-tooltip-kap");
  await expect
    .poll(
      async () => {
        const points = await findNeutralNodePoints(canvas);
        for (const candidate of points) {
          await page.mouse.move(candidate.x, candidate.y);
          await page.waitForTimeout(20);
          const tooltipText = await tooltip.textContent();
          const skill = selectableBackendSkills.find((item) =>
            tooltipText?.startsWith(`${item} ·`),
          );
          if (skill) {
            point = candidate;
            selectedSkill = skill;
            return true;
          }
        }
        return false;
      },
      { intervals: [100, 200, 400, 800], timeout: 3_000 },
    )
    .toBe(true);
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [
      {
        force: 1,
        id: 1,
        radiusX: 7,
        radiusY: 7,
        x: point!.x,
        y: point!.y,
      },
    ],
    type: "touchStart",
  });
  await page.waitForTimeout(40);
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [],
    type: "touchEnd",
  });

  expect(selectedSkill).not.toBeNull();
  await expect(
    page
      .getByRole("complementary", { name: "선택 기술 분석" })
      .getByRole("heading", { name: selectedSkill!, exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('button[aria-pressed="true"]')
      .filter({ hasText: "선택 주변" }),
  ).toHaveCount(1);
}

test("keeps fixture graph scope aligned with the production API contract", async ({
  request,
}) => {
  const unseededResponse = await request.get(
    "http://127.0.0.1:8011/api/graph/skills?limit=30",
  );
  const unknownResponse = await request.get(
    "http://127.0.0.1:8011/api/graph/skills?seed=UnknownSkill&limit=30",
  );
  const evidenceResponse = await request.get(
    "http://127.0.0.1:8011/api/graph/skills/evidence?skill=Kubernetes&limit=6",
  );
  const fitResponse = await request.post(
    "http://127.0.0.1:8011/api/fit/analyze",
    { data: { owned_skills: ["Rust"] } },
  );
  const unseeded = await unseededResponse.json();
  const unknown = await unknownResponse.json();
  const evidence = await evidenceResponse.json();
  const fit = await fitResponse.json();

  expect(unseeded.seed).toBeNull();
  expect(unseeded.evidence).toEqual([]);
  expect(unseeded.nodes.map((node: { id: string }) => node.id)).toContain("Go");
  expect(unknown.seed).toBe("UnknownSkill");
  expect(unknown.edges).toEqual([]);
  expect(unknown.evidence).toEqual([]);
  expect(evidence).toMatchObject({ total: 1 });
  expect(evidence.items).toHaveLength(1);
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

for (const width of [1440, 820, 390, 320]) {
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
      page.getByRole("heading", { level: 1, name: "스킬맵" }),
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

    const graphFrame = page.locator(
      '[data-testid="skill-graph-frame"]:visible',
    );
    const graphBox = await graphFrame.boundingBox();
    expect(graphBox?.height).toBeGreaterThanOrEqual(width <= 640 ? 400 : 496);
    const forceCanvas = graphFrame.locator(".force-canvas--ready");
    await expect(forceCanvas).toBeVisible();
    await expect(forceCanvas.locator("canvas")).toBeVisible();
    await expect(
      graphFrame.getByRole("group", { name: "그래프 보기 조절" }),
    ).toBeVisible();
    const graphMetrics = page.getByRole("group", { name: "현재 그래프 규모" });
    const displayedSkills = Number(
      await graphMetrics.getByText("표시 기술").locator("..").locator("dd").textContent(),
    );
    const displayedLinks = Number(
      await graphMetrics.getByText("표시 관계").locator("..").locator("dd").textContent(),
    );
    expect(displayedSkills).toBeLessThanOrEqual(width <= 640 ? 8 : 9);
    expect(displayedLinks).toBeLessThanOrEqual(width <= 640 ? 10 : 12);
    await expect(
      page.getByRole("checkbox", { name: "관련 공고" }),
    ).toHaveCount(0);
    const legend = graphFrame.getByRole("note", { name: "스킬맵 범례" });
    const graphControls = graphFrame.getByRole("group", {
      name: "그래프 보기 조절",
    });
    await expect(legend).toBeVisible();
    await expect(legend).toContainText("크기: 시장 수요");
    await expect(legend).toContainText("테두리: 내 기술");
    await expect(legend).toContainText("점선: 추천 기술");
    await expect(legend).toContainText("선 농도: 함께 요구");
    const [legendBox, graphControlsBox] = await Promise.all([
      legend.boundingBox(),
      graphControls.boundingBox(),
    ]);
    expect(legendBox).not.toBeNull();
    expect(graphControlsBox).not.toBeNull();
    expect(rectanglesOverlap(legendBox!, graphControlsBox!)).toBe(false);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    if (width === 1440) {
      await expect(
        graphFrame.getByText("드래그 · 확대 · 선택", { exact: true }),
      ).toBeVisible();

      const canvas = forceCanvas.locator("canvas");
      await waitForPaintedCanvas(canvas);
      await waitForZoomStability(canvas);
      const beforeDrag = await readCanvasZoom(canvas);
      const canvasBox = await canvas.boundingBox();
      expect(beforeDrag).not.toBeNull();
      expect(canvasBox).not.toBeNull();

      await page.mouse.move(canvasBox!.x + 32, canvasBox!.y + 32);
      await page.mouse.down();
      await page.mouse.move(canvasBox!.x + 104, canvasBox!.y + 80, {
        steps: 6,
      });
      await page.mouse.up();

      await expect
        .poll(async () => {
          const afterDrag = await readCanvasZoom(canvas);
          if (!beforeDrag || !afterDrag) return 0;
          return Math.hypot(
            afterDrag.x - beforeDrag.x,
            afterDrag.y - beforeDrag.y,
          );
        })
        .toBeGreaterThan(1);
    }

    if (width <= 900) {
      const disclosure = page.locator("details").filter({
        hasText: "내 기술과 그래프 범위",
      });
      await expect(disclosure).not.toHaveAttribute("open", "");

      if (width <= 820) {
        const summary = disclosure.locator("summary");
        const nextSkillHeading = page.getByRole("heading", {
          name: "다음에 배울 기술",
          exact: true,
        });
        const relatedSkillHeading = inspector.getByRole("heading", {
          name: "함께 요구되는 기술",
          exact: true,
        });
        const [summaryBox, nextSkillBox, relatedSkillBox] = await Promise.all([
          summary.boundingBox(),
          nextSkillHeading.boundingBox(),
          relatedSkillHeading.boundingBox(),
        ]);
        expect(summaryBox).not.toBeNull();
        expect(nextSkillBox).not.toBeNull();
        expect(relatedSkillBox).not.toBeNull();
        expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(
          graphBox!.y,
        );
        expect(graphBox!.y + graphBox!.height).toBeLessThanOrEqual(
          nextSkillBox!.y,
        );
        expect(graphBox!.y + graphBox!.height).toBeLessThanOrEqual(
          relatedSkillBox!.y,
        );
      }

      await disclosure.locator("summary").click();
      await expect(page.getByLabel("기술 추가")).toBeVisible();

      if (width === 320) {
        for (const target of [
          disclosure.getByRole("button", { name: "추가", exact: true }),
          disclosure.getByRole("button", { name: "초기화" }),
          disclosure.getByRole("button", { name: "선택 주변" }),
          disclosure.getByRole("button", { name: "전체 기술" }),
        ]) {
          const lineCount = await target.evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return new Set(
              Array.from(range.getClientRects(), (rect) => Math.round(rect.top)),
            ).size;
          });
          expect(lineCount).toBe(1);
        }
      }

      if (width === 390) {
        await page.getByLabel("기술 추가").fill("Rust");
        await page.getByRole("button", { name: "추가" }).click();

        for (const target of [
          page.getByRole("button", { name: "Rust 제거" }),
          page.getByRole("button", { name: "초기화" }),
          page.getByRole("button", { name: "선택 주변" }),
          page.getByRole("button", { name: "전체 기술" }),
          page.getByRole("button", { name: /클라우드/ }),
        ]) {
          const box = await target.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }
      }

      await disclosure.locator("summary").click();
      await expect(disclosure).not.toHaveAttribute("open", "");
    }

    if (width === 390) {
      const mobileNavigation = page.getByRole("navigation", {
        name: "모바일 주요 탐색",
      });
      await expect(mobileNavigation).toBeVisible();
      await graphFrame.evaluate((element) =>
        element.scrollIntoView({ block: "end" }),
      );
      await expect
        .poll(() =>
          graphFrame.evaluate(
            (element) =>
              element.getBoundingClientRect().bottom <= window.innerHeight,
          ),
        )
        .toBe(true);
      const mobileNavigationBox = await mobileNavigation.boundingBox();
      expect(mobileNavigationBox).not.toBeNull();

      for (const overlay of [
        graphFrame.getByRole("group", { name: "그래프 보기 조절" }),
        graphFrame.getByText("이동 · 두 손가락으로 확대 · 탭하여 선택"),
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

test("supports touch pan, pinch zoom, and node selection", async ({ browser }) => {
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

  const graphFrame = page.locator(
    '[data-testid="skill-graph-frame"]:visible',
  );
  const forceCanvas = graphFrame.locator(".force-canvas--ready");
  await expect(forceCanvas).toBeVisible();
  await graphFrame.scrollIntoViewIfNeeded();
  const graphBox = await graphFrame.boundingBox();
  expect(graphBox).not.toBeNull();

  const canvas = forceCanvas.locator("canvas");
  const beforePan = await readCanvasZoom(canvas);
  await waitForPaintedCanvas(canvas);
  await dispatchTouchPan(session, {
    x: graphBox!.x + 72,
    y: graphBox!.y + 72,
  });
  await expect
    .poll(async () => (await readCanvasZoom(canvas))?.x)
    .not.toBe(beforePan?.x);
  const afterPan = await readCanvasZoom(canvas);
  expect(beforePan).not.toBeNull();

  await graphFrame.getByRole("button", { name: "그래프 확대" }).click();
  await expect
    .poll(async () => (await readCanvasZoom(canvas))?.k ?? 0)
    .toBeGreaterThan(afterPan?.k ?? 0);
  const afterButtonZoom = await readCanvasZoom(canvas);

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await dispatchPinch(page, session, {
    x: canvasBox!.x + canvasBox!.width / 2,
    y: canvasBox!.y + canvasBox!.height / 2,
  });
  await expect
    .poll(async () => (await readCanvasZoom(canvas))?.k ?? 0)
    .toBeGreaterThan(afterButtonZoom?.k ?? 0);

  await graphFrame.getByRole("button", { name: "그래프 전체 맞춤" }).click();
  await waitForZoomStability(canvas);
  await tapSkillNode(page, session, canvas);
  await context.close();
});

test("keeps a static, painted, touch-controllable graph with reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3102",
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
    viewport: { height: 844, width: 390 },
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await page.goto("/skills/graph?seed=Kubernetes");

  const graphFrame = page.locator(
    '[data-testid="skill-graph-frame"]:visible',
  );
  const forceCanvas = graphFrame.locator(".force-canvas--ready");
  const canvas = forceCanvas.locator("canvas");
  await expect(forceCanvas).toBeVisible();
  await expect(canvas).toBeVisible();
  await graphFrame.scrollIntoViewIfNeeded();

  const initialCanvas = await waitForCanvasStability(canvas);
  expect(initialCanvas.paintedPixels).toBeGreaterThan(0);
  const initialZoom = await readCanvasZoom(canvas);
  const canvasBox = await canvas.boundingBox();
  expect(initialZoom).not.toBeNull();
  expect(canvasBox).not.toBeNull();

  await dispatchTouchPan(session, {
    x: canvasBox!.x + 72,
    y: canvasBox!.y + 72,
  });
  await expect
    .poll(async () => (await readCanvasZoom(canvas))?.x)
    .not.toBe(initialZoom?.x);
  const afterPanCanvas = await waitForCanvasStability(canvas);
  expect(afterPanCanvas.hash).not.toBe(initialCanvas.hash);

  const beforePinch = await readCanvasZoom(canvas);
  await dispatchPinch(page, session, {
    x: canvasBox!.x + canvasBox!.width / 2,
    y: canvasBox!.y + canvasBox!.height / 2,
  });
  await expect
    .poll(async () => (await readCanvasZoom(canvas))?.k ?? 0)
    .toBeGreaterThan(beforePinch?.k ?? 0);
  const afterPinchCanvas = await waitForCanvasStability(canvas);
  expect(afterPinchCanvas.hash).not.toBe(afterPanCanvas.hash);

  await graphFrame.getByRole("button", { name: "그래프 전체 맞춤" }).click();
  await waitForCanvasStability(canvas);
  await tapSkillNode(page, session, canvas);
  await context.close();
});
