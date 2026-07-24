import { expect, test, type Page } from "@playwright/test";

type ResourceMetric = {
  name: string;
  transferSize: number;
};

type FontResponseMetric = {
  pathname: string;
  status: number;
};

async function coldResources(page: Page, route: string) {
  const fontResponses: FontResponseMetric[] = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (
      pathname.includes("/fonts/pretendard/") ||
      pathname.endsWith(".woff2")
    ) {
      fontResponses.push({ pathname, status: response.status() });
    }
  });

  await page.goto(route);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);

  const resources = (await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        name: resource.name,
        transferSize: resource.transferSize,
      };
    }),
  )) as ResourceMetric[];

  return { fontResponses, resources };
}

for (const route of ["/", "/market"]) {
  test(`${route} keeps the self-hosted font within budget`, async ({ page }) => {
    const { fontResponses, resources } = await coldResources(page, route);
    const fontBytes = resources
      .filter(({ name }) => {
        const pathname = new URL(name).pathname;
        return (
          pathname.includes("/fonts/pretendard/") ||
          pathname.endsWith(".woff2")
        );
      })
      .reduce((total, resource) => total + resource.transferSize, 0);
    const subsetResponses = fontResponses.filter(
      ({ pathname }) =>
        pathname.includes("/fonts/pretendard/") &&
        pathname.endsWith(".woff2"),
    );

    expect(fontResponses).toContainEqual({
      pathname:
        "/fonts/pretendard/pretendardvariable-dynamic-subset.min.css",
      status: 200,
    });
    expect(subsetResponses.length).toBeGreaterThan(0);
    expect(subsetResponses.every(({ status }) => status === 200)).toBe(true);
    expect(fontBytes).toBeGreaterThan(0);
    expect(fontBytes).toBeLessThanOrEqual(450 * 1024);
    expect(
      await page.evaluate(() =>
        document.fonts.check('400 16px "Pretendard Variable"'),
      ),
    ).toBe(true);
  });

  test(`${route} limits speculative RSC requests`, async ({ page }) => {
    const rscRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.searchParams.has("_rsc")) {
        rscRequests.push(`${url.pathname}${url.search}`);
      }
    });

    await page.goto(route);
    await page.waitForLoadState("networkidle");

    expect(
      rscRequests.length,
      `Speculative RSC requests:\n${rscRequests.join("\n")}`,
    ).toBeLessThanOrEqual(15);
  });
}

test("/market keeps initial JavaScript within budget", async ({ page }) => {
  const { resources } = await coldResources(page, "/market");
  const scripts = resources.filter(({ name }) => {
      const url = new URL(name);
      return (
        url.pathname.startsWith("/_next/static/chunks/") &&
        url.pathname.endsWith(".js")
      );
    });
  const scriptBytes = scripts.reduce(
    (total, resource) => total + resource.transferSize,
    0,
  );

  expect(scriptBytes).toBeGreaterThan(0);
  expect(
    scriptBytes,
    `Initial scripts:\n${scripts
      .map(({ name, transferSize }) => `${new URL(name).pathname} ${transferSize}`)
      .join("\n")}`,
  ).toBeLessThanOrEqual(275 * 1024);
});

test("/skills/graph stops sustained work after its finite layout", async ({
  page,
}) => {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await session.send("Performance.enable");

  await page.goto("/skills/graph?seed=Kubernetes");
  const graphFrame = page.locator('[data-testid="skill-graph-frame"]:visible');
  const forceCanvas = graphFrame.locator(".force-canvas--ready");
  await expect(forceCanvas).toBeVisible({ timeout: 20_000 });
  await expect(forceCanvas.locator("canvas")).toBeVisible();

  // The renderer has a 2.4s hard cooldown; this starts the measurement after it.
  await page.waitForTimeout(3_000);
  const readTaskDuration = async () => {
    const { metrics } = await session.send("Performance.getMetrics");
    return metrics.find((metric) => metric.name === "TaskDuration")?.value ?? 0;
  };
  const before = await readTaskDuration();
  await page.waitForTimeout(4_000);
  const idleTaskMilliseconds = ((await readTaskDuration()) - before) * 1_000;

  expect(
    idleTaskMilliseconds,
    `Post-layout TaskDuration was ${idleTaskMilliseconds.toFixed(1)}ms`,
  ).toBeLessThanOrEqual(800);

  await page.evaluate(() => {
    const target = window as Window & { __skillGraphLongTasks?: number[] };
    target.__skillGraphLongTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        target.__skillGraphLongTasks?.push(entry.duration);
      }
    }).observe({ entryTypes: ["longtask"] });
  });

  await graphFrame.getByRole("button", { name: "그래프 확대" }).click();
  await graphFrame.getByRole("button", { name: "그래프 축소" }).click();
  const canvasBox = await forceCanvas.locator("canvas").boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(
    canvasBox!.x + canvasBox!.width / 2,
    canvasBox!.y + canvasBox!.height / 2,
  );
  await page.waitForTimeout(750);

  const longestInteractionTask = await page.evaluate(() =>
    Math.max(
      0,
      ...((window as Window & { __skillGraphLongTasks?: number[] })
        .__skillGraphLongTasks ?? []),
    ),
  );
  expect(longestInteractionTask).toBeLessThan(200);
});
