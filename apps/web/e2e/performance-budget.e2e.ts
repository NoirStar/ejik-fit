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
