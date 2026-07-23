import { expect, test } from "@playwright/test";

const fitResponse = {
  coverage: {
    matching_posting_count: 17,
    strong_fit_posting_count: 6,
  },
  recommended_next_skills: [
    {
      skill: "Kubernetes",
      reason: "공개 공고에서 반복된 부족 요구사항",
      required_count: 8,
      preferred_count: 3,
      supporting_posting_count: 10,
    },
  ],
  domain_branches: [
    {
      domain: "backend",
      covered_skills: ["Python"],
      missing_required_skills: ["Kubernetes"],
      missing_preferred_skills: [],
      supporting_posting_count: 9,
    },
  ],
};

test("keeps career evidence and the shared stack synchronized on mobile", async ({
  page,
}) => {
  const fitRequests: Array<Record<string, unknown>> = [];
  await page.setViewportSize({ height: 844, width: 320 });
  await page.route("**/skills/graph/fit", async (route) => {
    fitRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ json: fitResponse });
  });
  await page.goto("/career");

  await expect(
    page.getByRole("heading", { level: 1, name: "내 커리어" }),
  ).toBeVisible();
  await expect(page.getByText("이 기기에 저장됨")).toBeVisible();

  await page.getByLabel("추가할 기술").fill("Python");
  await page.getByRole("button", { name: "기술 추가" }).click();
  await expect(
    page.getByRole("heading", { name: "공고와 비교" }),
  ).toBeVisible();
  await expect(page.getByText("17건", { exact: true })).toBeVisible();

  const domainSelect = page.getByLabel("희망 기술 분야");
  await expect(
    domainSelect.getByRole("option", { name: "클라우드 · 연결 기술 1개" }),
  ).toBeAttached();
  await domainSelect.selectOption("cloud");
  await expect(page.getByText("클라우드 조건", { exact: true })).toBeVisible();
  await expect.poll(() => fitRequests.at(-1)).toMatchObject({
    owned_skills: ["Python"],
    domains: ["cloud"],
  });
  const careerSelect = page.getByLabel("경력 조건");
  await careerSelect.selectOption("experienced");
  await expect.poll(() => fitRequests.at(-1)).toMatchObject({
    owned_skills: ["Python"],
    career_type: "experienced",
    domains: ["cloud"],
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("ejik-fit:career-preferences") ?? "null",
        ),
      ),
    )
    .toEqual({ careerCondition: "experienced", targetDomain: "cloud" });
  const domainBox = await domainSelect.boundingBox();
  expect(domainBox?.height).toBeGreaterThanOrEqual(44);
  const careerBox = await careerSelect.boundingBox();
  expect(careerBox?.height).toBeGreaterThanOrEqual(44);

  await page.getByLabel("추가할 기술").fill("React");
  await page.getByRole("button", { name: "기술 추가" }).click();

  await expect(
    page.getByRole("list", { name: "내 기술 목록" }),
  ).toContainText("React");
  await expect.poll(() => fitRequests.at(-1)).toMatchObject({
    owned_skills: ["Python", "React"],
    career_type: "experienced",
    domains: ["cloud"],
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "공고와 비교" }),
  ).toBeVisible();
  await expect(careerSelect).toHaveValue("experienced");
  await expect(domainSelect).toHaveValue("cloud");
  await expect.poll(() => fitRequests.at(-1)).toMatchObject({
    owned_skills: ["Python", "React"],
    career_type: "experienced",
    domains: ["cloud"],
  });

  await page.setViewportSize({ height: 1024, width: 768 });
  await expect(page.getByLabel("경력 조건")).toBeVisible();
  await expect(domainSelect).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
