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
  await page.setViewportSize({ height: 844, width: 390 });
  await page.route("**/skills/graph/fit", async (route) => {
    await route.fulfill({ json: fitResponse });
  });
  await page.goto("/career");

  await page.getByLabel("추가할 기술").fill("Python");
  await page.getByRole("button", { name: "기술 추가" }).click();
  await expect(
    page.getByRole("heading", { name: "공고 비교 결과" }),
  ).toBeVisible();
  await expect(page.getByText("17건", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "내 스택 열기" }).click();
  const dialog = page.getByRole("dialog", { name: "내 스택" });
  await expect(dialog.getByText("Python", { exact: true })).toBeVisible();
  await dialog.getByLabel("추가할 기술").fill("React");
  await dialog.getByRole("button", { name: "기술 추가" }).click();
  await dialog.getByRole("button", { name: "내 스택 닫기" }).click();

  await expect(
    page.getByRole("list", { name: "저장한 기술 목록" }),
  ).toContainText("React");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
