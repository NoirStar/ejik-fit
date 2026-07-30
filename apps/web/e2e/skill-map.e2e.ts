import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from "@playwright/test";

import { GRAPH_DOMAIN_COLORS } from "../src/styles/design-tokens";

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

const backendNodeRgb = [
  Number.parseInt(GRAPH_DOMAIN_COLORS.backend.slice(1, 3), 16),
  Number.parseInt(GRAPH_DOMAIN_COLORS.backend.slice(3, 5), 16),
  Number.parseInt(GRAPH_DOMAIN_COLORS.backend.slice(5, 7), 16),
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

async function waitForZoomStability(
  canvas: Locator,
): Promise<CanvasZoom | null> {
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

async function dispatchTouchScroll(
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
        x: start.x,
        y: start.y - 160,
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

async function findBackendNodeOffsets(canvas: Locator) {
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
      const step = 2;
      const gridWidth = Math.ceil(canvasElement.width / step);
      const matchingPixels = new Set<number>();
      for (let y = 0; y < canvasElement.height; y += 2) {
        for (let x = 0; x < canvasElement.width; x += 2) {
          const offset = (y * canvasElement.width + x) * 4;
          if (
            Math.abs(pixels[offset] - red) <= 14 &&
            Math.abs(pixels[offset + 1] - green) <= 14 &&
            Math.abs(pixels[offset + 2] - blue) <= 14 &&
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
      const rect = canvasElement.getBoundingClientRect();
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
            x: x * (rect.width / canvasElement.width),
            y: y * (rect.height / canvasElement.height),
          };
        });
    },
    backendNodeRgb,
  );
}

async function tapSkillNode(
  page: Page,
  session: CDPSession,
  canvas: Locator,
) {
  const selectableBackendSkills = ["Docker", "Go", "Linux", "Python"];
  let offsets: CanvasPoint[] = [];
  await expect
    .poll(
      async () => {
        offsets = await findBackendNodeOffsets(canvas);
        return offsets.length;
      },
      { intervals: [100, 200, 400, 800, 1_200], timeout: 8_000 },
    )
    .toBeGreaterThan(0);

  const selectedHeading = page
    .getByRole("complementary", { name: "선택 기술 분석" })
    .getByRole("heading", { level: 2 })
    .first();
  const initialSkill = (await selectedHeading.textContent())?.trim() ?? "";
  const requireDifferentSelection = !selectableBackendSkills.includes(
    initialSkill,
  );
  for (const offset of offsets.slice(0, 8)) {
    const point = await canvas.evaluate((element, nodeOffset) => {
      const canvasElement = element as HTMLCanvasElement;
      const beforeRect = canvasElement.getBoundingClientRect();
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollBy(
        0,
        beforeRect.top + nodeOffset.y - window.innerHeight / 2,
      );
      root.style.scrollBehavior = previousScrollBehavior;

      const rect = canvasElement.getBoundingClientRect();
      const x = rect.left + nodeOffset.x;
      const y = rect.top + nodeOffset.y;
      return document.elementFromPoint(x, y) === canvasElement
        ? { x, y }
        : null;
    }, offset);
    if (!point) continue;

    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{
        force: 1,
        id: 1,
        radiusX: 7,
        radiusY: 7,
        x: point.x,
        y: point.y,
      }],
      type: "touchStart",
    });
    await page.waitForTimeout(40);
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd",
    });
    await page.waitForTimeout(80);

    const selectedSkill = (await selectedHeading.textContent())?.trim() ?? "";
    if (
      (!requireDifferentSelection || selectedSkill !== initialSkill) &&
      selectableBackendSkills.includes(selectedSkill)
    ) {
      await expect(
        page
          .getByRole("group", { name: "지도 범위" })
          .getByRole("button", { name: "전체 지도", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      return selectedSkill;
    }
  }

  throw new Error("터치 가능한 백엔드 기술 노드를 선택하지 못했습니다.");
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
    const topologyRequests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("/skills/graph/data")) {
        topologyRequests.push(request.url());
      }
    });

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

    const graphFrame = page.locator(
      '[data-testid="skill-graph-frame"]:visible',
    );
    const forceCanvas = graphFrame.locator(".force-canvas--ready");
    await expect(forceCanvas).toBeVisible();
    await expect(forceCanvas.locator("canvas")).toBeVisible();
    await expect(
      graphFrame.getByRole("group", { name: "그래프 보기 조절" }),
    ).toBeVisible();

    const scope = page.getByRole("group", { name: "지도 범위" });
    const atlasButton = scope.getByRole("button", {
      name: "전체 지도",
      exact: true,
    });
    const nearbyButton = scope.getByRole("button", {
      name: "선택 주변 보기",
      exact: true,
    });
    await expect(atlasButton).toHaveAttribute("aria-pressed", "true");

    const initialHud = graphFrame.getByText(
      /^\d+개 기술 · \d+개 관계$/,
    );
    const initialCounts = (await initialHud.textContent())?.match(
      /^(\d+)개 기술 · (\d+)개 관계$/,
    );
    expect(initialCounts).not.toBeNull();
    expect(Number(initialCounts?.[1])).toBeLessThanOrEqual(width <= 640 ? 30 : 48);
    expect(Number(initialCounts?.[2])).toBeLessThanOrEqual(width <= 640 ? 48 : 84);

    const topologyBeforeSelection = topologyRequests.length;
    const skillSearch = page.getByRole("combobox", { name: "기술 찾기" });
    await skillSearch.fill("Docker");
    await page
      .getByRole("listbox", { name: "기술 검색 결과" })
      .getByRole("option", { name: /^Docker/ })
      .click();
    await expect(page).toHaveURL(/\/skills\/graph\?seed=Docker$/, {
      timeout: 15_000,
    });
    await expect(atlasButton).toHaveAttribute("aria-pressed", "true");
    await expect(
      inspector.getByRole("heading", { name: "Docker" }),
    ).toBeVisible();
    await expect(
      inspector.getByText("언급 공고").locator("..").getByText("2건"),
    ).toBeVisible();
    await expect(
      inspector.getByRole("link", { name: /Go Platform Engineer/ }),
    ).toHaveAttribute("href", "/jobs/job-go");
    expect(topologyRequests).toHaveLength(topologyBeforeSelection);

    await nearbyButton.click();
    await expect(page).toHaveURL(
      /\/skills\/graph\?seed=Docker&view=nearby$/,
      { timeout: 15_000 },
    );
    await expect(nearbyButton).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => topologyRequests.length)
      .toBe(topologyBeforeSelection + 1);
    await expect(forceCanvas).toBeVisible();
    await expect(graphFrame.getByText("선택 주변", { exact: true })).toBeVisible();

    const focusedHud = graphFrame.getByText(
      /^\d+개 기술 · \d+개 관계$/,
    );
    const focusedCounts = (await focusedHud.textContent())?.match(
      /^(\d+)개 기술 · (\d+)개 관계$/,
    );
    expect(focusedCounts).not.toBeNull();
    expect(Number(focusedCounts?.[1])).toBeLessThanOrEqual(18);
    expect(Number(focusedCounts?.[2])).toBeLessThanOrEqual(30);

    const graphBox = await graphFrame.boundingBox();
    expect(graphBox?.height).toBeGreaterThanOrEqual(width <= 640 ? 400 : 496);
    await expect(
      page.getByRole("checkbox", { name: "관련 공고" }),
    ).toHaveCount(0);

    const legendButton = page.getByRole("button", {
      name: "읽는 법",
      exact: true,
    });
    await legendButton.click();
    const toolbarLegend = page.getByRole("note", { name: "스킬맵 범례" });
    await expect(graphFrame.getByRole("note", { name: "스킬맵 범례" })).toHaveCount(0);
    await expect(toolbarLegend).toBeVisible();
    await expect(toolbarLegend).toContainText("크기: 시장 수요");
    await expect(toolbarLegend).toContainText("색: 기술 분야");
    await expect(toolbarLegend).toContainText("테두리: 내 기술");
    await expect(toolbarLegend).toContainText("점: 학습 추천");
    await expect(toolbarLegend).toContainText("선 농도: 함께 요구");
    await legendButton.click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);

    if (width === 1440) {
      await expect(
        graphFrame.getByText("드래그 · 확대 · 기술 선택", { exact: true }),
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
      const toolbar = page.getByRole("region", { name: "스킬맵 도구" });
      const ownedSkillsButton = page.getByRole("button", {
        name: /^내 기술 \d+$/,
      });
      await expect(ownedSkillsButton).toHaveAttribute("aria-expanded", "false");

      if (width <= 820) {
        const nextSkillHeading = page.getByRole("heading", {
          name: "다음에 배울 기술",
          exact: true,
        });
        const relatedSkillHeading = inspector.getByRole("heading", {
          name: "함께 요구되는 기술",
          exact: true,
        });
        const [toolbarBox, nextSkillBox, relatedSkillBox] = await Promise.all([
          toolbar.boundingBox(),
          nextSkillHeading.boundingBox(),
          relatedSkillHeading.boundingBox(),
        ]);
        expect(toolbarBox).not.toBeNull();
        expect(nextSkillBox).not.toBeNull();
        expect(relatedSkillBox).not.toBeNull();
        expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(
          graphBox!.y,
        );
        expect(graphBox!.y + graphBox!.height).toBeLessThanOrEqual(
          nextSkillBox!.y,
        );
        expect(graphBox!.y + graphBox!.height).toBeLessThanOrEqual(
          relatedSkillBox!.y,
        );
      }

      await ownedSkillsButton.click();
      await expect(page.getByLabel("추가할 기술")).toBeVisible();

      if (width === 320) {
        for (const target of [
          page.getByRole("button", { name: "추가", exact: true }),
          atlasButton,
          nearbyButton,
        ]) {
          const lineCount = await target.evaluate((element) => {
            const lineTops = new Set<number>();
            const walker = document.createTreeWalker(
              element,
              NodeFilter.SHOW_TEXT,
            );
            while (walker.nextNode()) {
              if (!walker.currentNode.textContent?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(walker.currentNode);
              Array.from(range.getClientRects()).forEach((rect) => {
                lineTops.add(Math.round(rect.top));
              });
            }
            return lineTops.size;
          });
          expect(lineCount, (await target.textContent()) ?? "button label").toBe(1);
        }
      }

      if (width === 390) {
        await page.getByLabel("추가할 기술").fill("Rust");
        await page.getByRole("button", { name: "추가", exact: true }).click();

        for (const target of [
          page.getByRole("button", { name: "Rust 제거" }),
          atlasButton,
          nearbyButton,
          skillSearch,
        ]) {
          const box = await target.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }
      }

      await ownedSkillsButton.click();
      await expect(ownedSkillsButton).toHaveAttribute("aria-expanded", "false");
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

      const usesCoarsePointer = await page.evaluate(() =>
        window.matchMedia("(pointer: coarse)").matches,
      );
      const overlays = [
        graphFrame.getByRole("group", { name: "그래프 보기 조절" }),
      ];
      if (usesCoarsePointer) {
        overlays.push(
          graphFrame.getByText(
            "기술을 누르거나 그래프 조작을 시작하세요",
            { exact: true },
          ),
          graphFrame.getByRole("button", { name: "그래프 조작 시작" }),
        );
      }

      for (const overlay of overlays) {
        const overlayBox = await overlay.boundingBox();
        expect(overlayBox).not.toBeNull();
        expect(overlayBox!.y + overlayBox!.height).toBeLessThanOrEqual(
          mobileNavigationBox!.y,
        );
      }

      const searchTarget = await skillSearch.boundingBox();
      expect(searchTarget?.height).toBeGreaterThanOrEqual(44);

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

test("filters domains without rebuilding the canvas", async ({ page }) => {
  const topologyRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/skills/graph/data")) {
      topologyRequests.push(request.url());
    }
  });

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/skills/graph?seed=Kubernetes");

  const graphFrame = page.locator('[data-testid="skill-graph-frame"]:visible');
  const forceCanvas = graphFrame.locator(".force-canvas--ready");
  const canvas = forceCanvas.locator("canvas");
  const graphMetric = graphFrame.getByText(/^\d+개 기술 · \d+개 관계$/);

  await expect(forceCanvas).toBeVisible();
  const initialMetric = await graphMetric.textContent();
  const initialCounts = initialMetric?.match(/^(\d+)개 기술 · (\d+)개 관계$/);
  expect(initialCounts).not.toBeNull();
  const initialFingerprint = await waitForCanvasStability(canvas);
  const initialZoom = await waitForZoomStability(canvas);
  const requestCountBeforeFilter = topologyRequests.length;

  await forceCanvas.evaluate((element) => {
    const canvasElement = element as HTMLElement & {
      __skillMapReadyObserver?: MutationObserver;
    };
    canvasElement.dataset.readyDrops = "0";
    canvasElement.__skillMapReadyObserver?.disconnect();
    canvasElement.__skillMapReadyObserver = new MutationObserver(() => {
      if (!canvasElement.classList.contains("force-canvas--ready")) {
        canvasElement.dataset.readyDrops = String(
          Number(canvasElement.dataset.readyDrops ?? "0") + 1,
        );
      }
    });
    canvasElement.__skillMapReadyObserver.observe(canvasElement, {
      attributeFilter: ["class"],
      attributes: true,
    });
  });

  const domainButton = page.getByRole("button", {
    name: "분야 전체",
    exact: true,
  });
  await domainButton.click();
  const domainDialog = page.getByRole("dialog", { name: "분야 필터" });
  await expect(domainDialog).toBeVisible();
  await domainDialog
    .getByRole("button", { name: /^백엔드 \d+$/ })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForTimeout(40);
  const middleFingerprint = await readCanvasFingerprint(canvas);

  await expect(
    page.getByRole("button", { name: "분야 백엔드", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(graphMetric).not.toHaveText(initialMetric ?? "");
  const filteredMetric = await graphMetric.textContent();
  const filteredCounts = filteredMetric?.match(/^(\d+)개 기술 · (\d+)개 관계$/);
  expect(filteredCounts).not.toBeNull();
  expect(Number(filteredCounts?.[1])).toBeLessThan(Number(initialCounts?.[1]));
  expect(Number(filteredCounts?.[2])).toBeLessThan(Number(initialCounts?.[2]));
  await expect(forceCanvas).toBeVisible();
  await page.waitForTimeout(240);
  const filteredFingerprint = await readCanvasFingerprint(canvas);
  const filteredZoom = await readCanvasZoom(canvas);

  expect(topologyRequests).toHaveLength(requestCountBeforeFilter);
  expect(await forceCanvas.getAttribute("data-ready-drops")).toBe("0");
  expect(initialFingerprint.hash).not.toBe(filteredFingerprint.hash);
  expect(middleFingerprint.hash).not.toBe(filteredFingerprint.hash);
  expect(filteredZoom?.k).toBeCloseTo(initialZoom?.k ?? 0, 4);
  expect(filteredZoom?.x).toBeCloseTo(initialZoom?.x ?? 0, 1);
  expect(filteredZoom?.y).toBeCloseTo(initialZoom?.y ?? 0, 1);

  await domainDialog.getByRole("button", { name: /^전체 \d+$/ }).click();
  await expect(graphMetric).toHaveText(initialMetric ?? "");
  await page.waitForTimeout(240);
  expect(topologyRequests).toHaveLength(requestCountBeforeFilter);
  expect(await forceCanvas.getAttribute("data-ready-drops")).toBe("0");

  await page.keyboard.press("Escape");
  await expect(domainButton).toHaveAttribute("aria-expanded", "false");
  await expect(domainButton).toBeFocused();
});

test("supports page scroll, pinch zoom, and node selection on touch", async ({ browser }) => {
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
  await waitForPaintedCanvas(canvas);
  const beforeScrollZoom = await waitForZoomStability(canvas);
  await expect(graphFrame).toHaveAttribute("data-touch-interaction", "disabled");
  const beforeScrollY = await page.evaluate(() => window.scrollY);
  await dispatchTouchScroll(session, {
    x: graphBox!.x + graphBox!.width - 24,
    y: graphBox!.y + graphBox!.height - 80,
  });
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(beforeScrollY);
  const afterScrollZoom = await readCanvasZoom(canvas);
  expect(beforeScrollZoom).not.toBeNull();
  expect(afterScrollZoom?.x).toBeCloseTo(beforeScrollZoom?.x ?? 0, 1);
  expect(afterScrollZoom?.y).toBeCloseTo(beforeScrollZoom?.y ?? 0, 1);

  const defaultTapSelection = await tapSkillNode(page, session, canvas);
  await expect(page).toHaveURL(
    new RegExp(`\\bseed=${encodeURIComponent(defaultTapSelection)}(?:&|$)`),
  );
  await expect(graphFrame).toHaveAttribute("data-touch-interaction", "disabled");

  await graphFrame.evaluate((element) => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    element.scrollIntoView({ block: "center" });
    root.style.scrollBehavior = previousScrollBehavior;
  });
  await graphFrame.getByRole("button", { name: "그래프 확대" }).click();
  await expect
    .poll(async () => (await readCanvasZoom(canvas))?.k ?? 0)
    .toBeGreaterThan(afterScrollZoom?.k ?? 0);
  const afterButtonZoom = await readCanvasZoom(canvas);

  await graphFrame.getByRole("button", { name: "그래프 조작 시작" }).click();
  await expect(graphFrame).toHaveAttribute("data-touch-interaction", "enabled");

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
  const selectedSkill = await tapSkillNode(page, session, canvas);
  await expect(page).toHaveURL(
    new RegExp(`\\bseed=${encodeURIComponent(selectedSkill)}(?:&|$)`),
  );
  await expect(graphFrame.locator(".force-canvas--ready")).toBeVisible();
  await expect(graphFrame.locator(".graph-node")).toHaveCount(0);
  await context.close();
});

test("shows graph interaction controls on a landscape touch viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3102",
    hasTouch: true,
    isMobile: true,
    viewport: { height: 768, width: 1024 },
  });
  const page = await context.newPage();
  await page.goto("/skills/graph?seed=Kubernetes");

  const graphFrame = page.locator(
    '[data-testid="skill-graph-frame"]:visible',
  );
  await expect(graphFrame.locator(".force-canvas--ready")).toBeVisible();
  await expect(
    graphFrame.getByRole("button", { name: "그래프 조작 시작" }),
  ).toBeVisible();
  for (const target of [
    graphFrame.getByRole("button", { name: "그래프 조작 시작" }),
    page.getByRole("button", { name: "Kubernetes 내 기술에 추가" }),
    page.getByRole("link", { name: "Kubernetes 관련 공고 모두 보기" }),
  ]) {
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

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
  let canvasBox = await canvas.boundingBox();
  expect(initialZoom).not.toBeNull();
  expect(canvasBox).not.toBeNull();

  const beforeScrollY = await page.evaluate(() => window.scrollY);
  await dispatchTouchScroll(session, {
    x: canvasBox!.x + canvasBox!.width - 24,
    y: canvasBox!.y + canvasBox!.height - 80,
  });
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(beforeScrollY);
  const afterScrollZoom = await readCanvasZoom(canvas);
  expect(afterScrollZoom?.x).toBeCloseTo(initialZoom?.x ?? 0, 1);
  expect(afterScrollZoom?.y).toBeCloseTo(initialZoom?.y ?? 0, 1);
  const afterPanCanvas = await waitForCanvasStability(canvas);
  expect(afterPanCanvas.hash).toBe(initialCanvas.hash);

  await graphFrame.getByRole("button", { name: "그래프 조작 시작" }).click();
  await expect(graphFrame).toHaveAttribute("data-touch-interaction", "enabled");

  await graphFrame.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
  await page.waitForTimeout(300);
  const beforePinch = await readCanvasZoom(canvas);
  canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
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
