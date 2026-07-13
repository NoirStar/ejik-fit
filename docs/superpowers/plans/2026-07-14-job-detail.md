# Verified Job Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/jobs/[id]` as an evidence-first job detail that preserves official API facts, shares browser-saved state, and compares only exact owned-skill overlap.

**Architecture:** Keep API fetching, runtime validation, metadata, and JSON-LD in the server route. Move deterministic evidence/description shaping into a pure model, browser-local actions into one focused client component, and semantic detail rendering into feature components that receive a validated `PostingDetail`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library, Playwright, existing `CompanyMark`, saved-jobs, and owned-skills utilities.

## Global Constraints

- Use only validated fields returned by the official postings API.
- Do not generate a summary, match score, acceptance probability, recommendation, or prediction.
- Render `description_text` as text nodes; never inject `description_html`.
- Official application links must use the existing HTTP(S)-only posting contract.
- Saved jobs and owned skills remain browser-local and must synchronize through existing same-tab and storage events.
- All interactive targets must be at least 44px in both dimensions.
- At 900px and below, use one content column; at 680px and below, stack facts and actions.
- Do not add a fixed mobile action bar that can overlap the shared bottom navigation.
- Add no new runtime dependency.

---

### Task 1: Deterministic Detail Evidence Model

**Files:**
- Create: `apps/web/src/features/jobs/job-detail-model.ts`
- Create: `apps/web/src/features/jobs/job-detail-model.test.ts`

**Interfaces:**
- Consumes: `SkillDetail` from `@/lib/types` and browser-owned skill strings.
- Produces: `groupJobSkills(skills: SkillDetail[]): JobSkillGroups`, `matchOwnedJobSkills(skills: SkillDetail[], ownedSkills: string[]): string[]`, and `parsePostingDescription(text: string): JobDescriptionBlock[]`.

- [ ] **Step 1: Write failing grouping and overlap tests**

```ts
import { describe, expect, it } from "vitest";

import {
  groupJobSkills,
  matchOwnedJobSkills,
  parsePostingDescription,
} from "./job-detail-model";

const skills = [
  {
    skill: "Go",
    category: "language",
    requirement_type: "required" as const,
    evidence_text: "Go 기반 서버 개발 경험",
    confidence: 0.98,
    match_reason: "distinct_alias",
  },
  {
    skill: "Kubernetes",
    category: "infra",
    requirement_type: "preferred" as const,
    evidence_text: "Kubernetes 운영 경험",
    confidence: 0.96,
    match_reason: "distinct_alias",
  },
  {
    skill: "Jira",
    category: "qa",
    requirement_type: "unspecified" as const,
    evidence_text: null,
    confidence: 1,
    match_reason: "distinct_alias",
  },
];

describe("job detail model", () => {
  it("keeps API requirement groups separate", () => {
    expect(groupJobSkills(skills)).toEqual({
      required: [skills[0]],
      preferred: [skills[1]],
      unspecified: [skills[2]],
    });
  });

  it("matches owned skills exactly without case sensitivity", () => {
    expect(matchOwnedJobSkills(skills, ["go", "KUBERNETES", "Java"])).toEqual([
      "Go",
      "Kubernetes",
    ]);
  });
});
```

- [ ] **Step 2: Run the model tests and confirm the missing module failure**

Run: `npm test -- --run src/features/jobs/job-detail-model.test.ts`

Expected: FAIL because `job-detail-model.ts` does not exist.

- [ ] **Step 3: Implement skill grouping and exact overlap**

```ts
import type { SkillDetail } from "@/lib/types";

export type JobSkillGroups = {
  required: SkillDetail[];
  preferred: SkillDetail[];
  unspecified: SkillDetail[];
};

export function groupJobSkills(skills: SkillDetail[]): JobSkillGroups {
  return {
    required: skills.filter((skill) => skill.requirement_type === "required"),
    preferred: skills.filter((skill) => skill.requirement_type === "preferred"),
    unspecified: skills.filter(
      (skill) => skill.requirement_type === "unspecified",
    ),
  };
}

export function matchOwnedJobSkills(
  skills: SkillDetail[],
  ownedSkills: string[],
): string[] {
  const owned = new Set(ownedSkills.map((skill) => skill.trim().toLocaleLowerCase()));
  return Array.from(
    new Map(
      skills
        .filter((skill) => owned.has(skill.skill.toLocaleLowerCase()))
        .map((skill) => [skill.skill.toLocaleLowerCase(), skill.skill]),
    ).values(),
  ).sort((left, right) => left.localeCompare(right));
}
```

- [ ] **Step 4: Add failing inline-description parsing tests**

```ts
it("preserves inline headings, bullets, and paragraphs without inventing text", () => {
  const source =
    "회사 소개 문장입니다. 주요업무 ### 이런 업무를 해요 * API를 개발합니다. * 장애를 분석합니다. ### 이런 분이면 더 좋아요 • Go 경험";

  expect(parsePostingDescription(source)).toEqual([
    { kind: "paragraph", text: "회사 소개 문장입니다. 주요업무" },
    { kind: "heading", level: 3, text: "이런 업무를 해요" },
    { kind: "list", items: ["API를 개발합니다.", "장애를 분석합니다."] },
    { kind: "heading", level: 3, text: "이런 분이면 더 좋아요" },
    { kind: "list", items: ["Go 경험"] },
  ]);
});

it("returns no blocks for an empty description", () => {
  expect(parsePostingDescription("  \n ")).toEqual([]);
});
```

- [ ] **Step 5: Implement lossless description tokenization**

```ts
export type JobDescriptionBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

function normalizedDescriptionLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+(?=#{2,4}\s+)/g, "\n")
    .replace(/[ \t]+(?=[*•◦]\s+)/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parsePostingDescription(text: string): JobDescriptionBlock[] {
  const blocks: JobDescriptionBlock[] = [];
  let listItems: string[] = [];
  const flushList = () => {
    if (listItems.length > 0) blocks.push({ kind: "list", items: listItems });
    listItems = [];
  };

  for (const line of normalizedDescriptionLines(text)) {
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length === 2 ? 2 : 3,
        text: heading[2].trim(),
      });
      continue;
    }
    const bullet = line.match(/^[*•◦]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1].trim());
      continue;
    }
    flushList();
    blocks.push({ kind: "paragraph", text: line });
  }
  flushList();
  return blocks;
}
```

- [ ] **Step 6: Run the model tests and commit**

Run: `npm test -- --run src/features/jobs/job-detail-model.test.ts`

Expected: all model tests PASS.

```bash
git add apps/web/src/features/jobs/job-detail-model.ts apps/web/src/features/jobs/job-detail-model.test.ts
git commit -m "feat: model verified job detail evidence"
```

---

### Task 2: Browser-Local Decision Panel

**Files:**
- Create: `apps/web/src/features/jobs/job-detail-actions.tsx`
- Create: `apps/web/src/features/jobs/job-detail-actions.test.tsx`
- Create: `apps/web/src/features/jobs/job-detail-actions.module.css`

**Interfaces:**
- Consumes: `jobId`, `jobTitle`, `sourceUrl`, and `SkillDetail[]` props; `readSavedJobIds`, `toggleSavedJob`, `subscribeSavedJobs`, `readOwnedSkills`, and `subscribeOwnedSkills`.
- Produces: `JobDetailActions`, a client component with official application, shared save state, and exact owned-skill overlap.

- [ ] **Step 1: Write failing interaction tests**

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { JobDetailActions } from "./job-detail-actions";

const props = {
  jobId: "job-1",
  jobTitle: "Backend Engineer",
  sourceUrl: "https://careers.example.com/job-1",
  skills: [
    {
      skill: "Go",
      category: "language",
      requirement_type: "required" as const,
      evidence_text: "Go 경험",
      confidence: 1,
      match_reason: "distinct_alias",
    },
  ],
};

describe("JobDetailActions", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("persists the same saved job id used by the list and home", () => {
    render(<JobDetailActions {...props} />);
    const save = screen.getByRole("button", { name: "Backend Engineer 저장" });
    fireEvent.click(save);
    expect(save).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("ejik-fit:saved-job-ids")).toBe(
      '["job-1"]',
    );
  });

  it("shows only exact owned skill overlap", () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["go", "Java"]),
    );
    render(<JobDetailActions {...props} />);
    expect(screen.getByText("내 기술과 겹침 1개")).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(screen.queryByText("Java")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component tests and verify the missing component failure**

Run: `npm test -- --run src/features/jobs/job-detail-actions.test.tsx`

Expected: FAIL because `JobDetailActions` does not exist.

- [ ] **Step 3: Implement hydration-safe subscriptions and actions**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  readOwnedSkills,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import type { SkillDetail } from "@/lib/types";

import { matchOwnedJobSkills } from "./job-detail-model";
import styles from "./job-detail-actions.module.css";

export function JobDetailActions({
  jobId,
  jobTitle,
  sourceUrl,
  skills,
}: {
  jobId: string;
  jobTitle: string;
  sourceUrl: string;
  skills: SkillDetail[];
}) {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);

  useEffect(() => {
    setSavedIds(readSavedJobIds());
    setOwnedSkills(readOwnedSkills());
    const stopSaved = subscribeSavedJobs(setSavedIds);
    const stopOwned = subscribeOwnedSkills(setOwnedSkills);
    return () => {
      stopSaved();
      stopOwned();
    };
  }, []);

  const matched = useMemo(
    () => matchOwnedJobSkills(skills, ownedSkills),
    [skills, ownedSkills],
  );
  const saved = savedIds.includes(jobId);

  return (
    <section
      aria-labelledby="job-actions-title"
      aria-label="지원 준비"
      className={styles.panel}
    >
      <h2 id="job-actions-title">지원 준비</h2>
      <a className={styles.apply} href={sourceUrl} rel="noreferrer" target="_blank">
        공식 채용페이지에서 지원
      </a>
      <button
        aria-label={`${jobTitle} ${saved ? "저장 해제" : "저장"}`}
        aria-pressed={saved}
        className={styles.save}
        onClick={() => setSavedIds(toggleSavedJob(jobId))}
        type="button"
      >
        {saved ? "저장됨" : "공고 저장"}
      </button>
      <div aria-live="polite" className={styles.overlap}>
        {ownedSkills.length === 0 ? (
          <Link href="/career">내 기술 저장하기</Link>
        ) : (
          <>
            <strong>내 기술과 겹침 {matched.length}개</strong>
            {matched.length > 0 && <span>{matched.join(" · ")}</span>}
          </>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add storage-failure and same-tab synchronization tests**

Add `act`, `waitFor`, `vi`, and `toggleSavedJob` imports, then add:

```tsx
it("does not claim a save succeeded when browser storage rejects it", () => {
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("blocked");
    });
  render(<JobDetailActions {...props} />);
  const save = screen.getByRole("button", { name: "Backend Engineer 저장" });
  fireEvent.click(save);
  expect(save).toHaveAttribute("aria-pressed", "false");
  write.mockRestore();
});

it("reacts to a save made elsewhere in the same tab", async () => {
  render(<JobDetailActions {...props} />);
  act(() => {
    toggleSavedJob("job-1");
  });
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Backend Engineer 저장 해제" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 5: Add decision-panel styles and verify**

```css
.panel {
  position: sticky;
  top: calc(var(--header-height) + 1.5rem);
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.apply,
.save {
  display: inline-flex;
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  font-weight: 750;
}

.apply {
  background: var(--color-accent);
  color: white;
}

.save {
  border: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

.overlap {
  display: grid;
  gap: 0.375rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-line);
  color: var(--color-muted);
}

@media (max-width: 900px) {
  .panel {
    position: static;
  }
}
```

Run: `npm test -- --run src/features/jobs/job-detail-actions.test.tsx src/lib/saved-jobs.test.ts src/lib/owned-skills.test.ts`

Expected: all tests PASS.

```bash
git add apps/web/src/features/jobs/job-detail-actions.tsx apps/web/src/features/jobs/job-detail-actions.test.tsx apps/web/src/features/jobs/job-detail-actions.module.css
git commit -m "feat: share job detail decision state"
```

---

### Task 3: Evidence-First Server Detail View

**Files:**
- Create: `apps/web/src/features/jobs/job-description.tsx`
- Create: `apps/web/src/features/jobs/job-detail-view.tsx`
- Modify: `apps/web/src/app/jobs/[id]/page.tsx`
- Modify: `apps/web/src/app/jobs/[id]/page.test.tsx`
- Modify: `apps/web/src/app/jobs/[id]/job-detail.module.css`

**Interfaces:**
- Consumes: a fully normalized `PostingDetail` and Task 1/2 components.
- Produces: `JobDetailView({ job }: { job: PostingDetail })` and `PostingDescription({ text }: { text: string })`.

- [ ] **Step 1: Expand page tests for the new evidence hierarchy**

```tsx
expect(screen.getByRole("heading", { level: 1, name: job.title })).toBeInTheDocument();
expect(screen.getByTitle("토스")).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "채용 조건" })).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "요구 기술 근거" })).toBeInTheDocument();
expect(screen.getByRole("link", { name: "Go 스킬맵" })).toHaveAttribute(
  "href",
  "/skill-map?skill=Go",
);
expect(screen.getByRole("heading", { name: "공고 원문" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "지원 준비" })).toBeInTheDocument();
```

```tsx
it("states when the API provides no body or confirmed skill evidence", async () => {
  vi.mocked(getPosting).mockResolvedValue({
    ...job,
    description_text: "",
    description_html: "<script>alert('never render')</script>",
    skills: [],
    skill_details: [],
  });
  render(await JobDetail({ params: Promise.resolve({ id: "job-1" }) }));
  expect(
    screen.getByText("확정 임계값을 통과한 기술 요구사항이 없습니다."),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "API가 제공한 공고 본문 텍스트가 없습니다. 공식 원문을 확인해 주세요.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("never render")).not.toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /공식/ }).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the page tests and verify hierarchy assertions fail**

Run: `npm test -- --run src/app/jobs/[id]/page.test.tsx`

Expected: FAIL because the new headings and decision region are absent.

- [ ] **Step 3: Implement safe semantic description rendering**

```tsx
import { parsePostingDescription } from "./job-detail-model";

export function PostingDescription({ text }: { text: string }) {
  const blocks = parsePostingDescription(text);
  if (blocks.length === 0) {
    return <p>API가 제공한 공고 본문 텍스트가 없습니다. 공식 원문을 확인해 주세요.</p>;
  }
  return (
    <div>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return block.level === 2 ? (
            <h3 key={`${block.text}-${index}`}>{block.text}</h3>
          ) : (
            <h4 key={`${block.text}-${index}`}>{block.text}</h4>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={`list-${index}`}>
              {block.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          );
        }
        return <p key={`paragraph-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement the feature view**

Create the view with the following structure, using local formatting helpers for Korean dates and `formatCareerRange` for the API career range:

```tsx
import Link from "next/link";

import { SourceMeta } from "@/components/source-meta";
import { CompanyMark } from "@/features/home-feed/company-mark";
import { formatCareerRange } from "@/features/jobs/model";
import { formatEmployment } from "@/lib/labels";
import type { PostingDetail, SkillDetail } from "@/lib/types";

import styles from "@/app/jobs/[id]/job-detail.module.css";
import { JobDetailActions } from "./job-detail-actions";
import { groupJobSkills } from "./job-detail-model";
import { PostingDescription } from "./job-description";

function SkillGroup({ label, skills }: { label: string; skills: SkillDetail[] }) {
  if (skills.length === 0) return null;
  return (
    <section className={styles.skillGroup}>
      <h3>{label}</h3>
      <ul role="list">
        {skills.map((skill) => (
          <li key={`${skill.requirement_type}-${skill.skill}`}>
            <Link
              aria-label={`${skill.skill} 스킬맵`}
              href={`/skill-map?skill=${encodeURIComponent(skill.skill)}`}
            >
              {skill.skill}
            </Link>
            {skill.evidence_text && <q>{skill.evidence_text}</q>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function JobDetailView({ job }: { job: PostingDetail }) {
  const groups = groupJobSkills(job.skill_details ?? []);
  const hasEvidence = (job.skill_details?.length ?? 0) > 0;
  return (
    <main className={styles.main}>
      <Link className={styles.backLink} href="/jobs">공고 탐색으로 돌아가기</Link>
      <article className={styles.article}>
        <header className={styles.hero}>
          <CompanyMark
            companyName={job.company_name}
            size={64}
            sourceUrl={job.source_url}
          />
          <div>
            <p>{job.company_name}</p>
            <h1>{job.title}</h1>
          </div>
          <span>{job.status === "open" ? "공개 중" : job.status}</span>
        </header>

        <section aria-labelledby="job-facts-title" className={styles.factsSection}>
          <h2 id="job-facts-title">채용 조건</h2>
          <dl className={styles.facts}>
            <div><dt>경력</dt><dd>{formatCareerRange(job)}</dd></div>
            <div><dt>고용 형태</dt><dd>{formatEmployment(job.employment_type)}</dd></div>
            <div><dt>근무지</dt><dd>{job.location ?? "미기재"}</dd></div>
            <div><dt>접수 기간</dt><dd>{formatPostingPeriod(job.opens_at, job.closes_at)}</dd></div>
          </dl>
        </section>

        <div className={styles.workspace}>
          <div className={styles.content}>
            <section aria-labelledby="job-skills-title" className={styles.skills}>
              <header>
                <p>공식 원문에서 확정된 표현</p>
                <h2 id="job-skills-title">요구 기술 근거</h2>
              </header>
              {hasEvidence ? (
                <div className={styles.skillGroups}>
                  <SkillGroup label="필수 기술" skills={groups.required} />
                  <SkillGroup label="우대 기술" skills={groups.preferred} />
                  <SkillGroup label="공고 언급" skills={groups.unspecified} />
                </div>
              ) : (
                <p>확정 임계값을 통과한 기술 요구사항이 없습니다.</p>
              )}
            </section>

            <section aria-labelledby="job-description-title" className={styles.description}>
              <header>
                <p>API가 제공한 원문 텍스트</p>
                <h2 id="job-description-title">공고 원문</h2>
              </header>
              <PostingDescription text={job.description_text} />
              <a href={job.source_url} rel="noreferrer" target="_blank">
                공식 원문에서 계속 읽기
              </a>
            </section>
          </div>

          <aside className={styles.sidebar}>
            <JobDetailActions
              jobId={job.id}
              jobTitle={job.title}
              skills={job.skill_details ?? []}
              sourceUrl={job.source_url}
            />
            <section aria-label="공고 신뢰 정보" className={styles.trust}>
              <h2>출처와 검증</h2>
              <SourceMeta sourceUrl={job.source_url} lastVerifiedAt={job.last_verified_at} />
              <nav aria-label="공고 정보 안내">
                <Link href="/methodology">분석 방법</Link>
                <Link href="/corrections">정보 정정 요청</Link>
                <Link href="/data-policy">데이터 정책</Link>
              </nav>
            </section>
          </aside>
        </div>
      </article>
    </main>
  );
}
```

Keep JSON-LD and metadata generation in the route. Define or move `formatPostingPeriod` into the view module with `미기재` wording, then replace only the route JSX body with `<JobDetailView job={job} />` after the JSON-LD script.

- [ ] **Step 5: Rebuild responsive CSS**

Use these layout rules and preserve the existing `.errorPage` and `.errorActions` definitions:

```css
.main { width: min(100%, 80rem); margin: 0 auto; padding: 2rem 1.5rem 6rem; }
.article { margin-top: 2rem; }
.hero { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 1rem; align-items: start; }
.hero h1 { max-width: 20ch; margin-top: 0.5rem; font-size: clamp(2.5rem, 5vw, 4.75rem); letter-spacing: -0.06em; line-height: 1.02; }
.factsSection { margin-top: 3rem; }
.facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-block: 1px solid var(--color-line); }
.facts > div { min-width: 0; padding: 1rem; border-right: 1px solid var(--color-line); }
.workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 21rem); gap: clamp(2rem, 5vw, 4.5rem); align-items: start; margin-top: 4rem; }
.content { min-width: 0; }
.skillGroups { display: grid; gap: 1rem; margin-top: 1.5rem; }
.description { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--color-line); }
.description > div { max-width: 74ch; margin-top: 1.5rem; }
.description p, .description li { color: var(--color-muted); font-size: 1rem; line-height: 1.85; }
.sidebar { display: grid; gap: 1rem; }

@media (max-width: 900px) {
  .workspace { grid-template-columns: 1fr; }
  .sidebar { grid-row: 1; }
}

@media (max-width: 680px) {
  .main { padding: 1.5rem 1rem calc(var(--mobile-nav-height) + 2rem); }
  .hero { grid-template-columns: auto minmax(0, 1fr); }
  .hero > span { grid-column: 2; }
  .facts { grid-template-columns: 1fr; }
  .facts > div { border-right: 0; border-bottom: 1px solid var(--color-line); }
}
```

- [ ] **Step 6: Verify route, shared utility, and TypeScript tests**

Run: `npm test -- --run src/app/jobs/[id]/page.test.tsx src/features/jobs/job-detail-model.test.ts src/features/jobs/job-detail-actions.test.tsx src/features/home-feed/company-mark.test.tsx`

Run: `npx tsc --noEmit`

Expected: all tests and TypeScript PASS.

```bash
git add apps/web/src/features/jobs/job-description.tsx apps/web/src/features/jobs/job-detail-view.tsx apps/web/src/app/jobs/[id]/page.tsx apps/web/src/app/jobs/[id]/page.test.tsx apps/web/src/app/jobs/[id]/job-detail.module.css
git commit -m "feat: rebuild verified job detail"
```

---

### Task 4: Browser Contract and Responsive Regression Coverage

**Files:**
- Modify: `apps/web/e2e/fixtures/test-api.mjs`
- Create: `apps/web/e2e/job-detail.e2e.ts`

**Interfaces:**
- Consumes: the existing local fixture server and `/jobs` Playwright environment.
- Produces: a deterministic detail endpoint for `job-python` and browser tests covering list-to-detail navigation, local state, responsive layout, and action target geometry.

- [ ] **Step 1: Add a fixture detail response**

Define `postingDetails` after `postings`, then add the detail branch before the list branch:

```js
const postingDetails = {
  "job-python": {
    ...postings.items[0],
    description_html: "<p>Do not render this HTML</p>",
    description_text:
      "제품 소개입니다. ### 주요 업무 * Python API를 개발합니다. * 장애 원인을 분석합니다. ### 우대 사항 • Kubernetes 운영 경험",
    skills: ["Python", "Kubernetes"],
    skill_details: [
      {
        skill: "Python",
        category: "language",
        requirement_type: "required",
        evidence_text: "Python API를 개발합니다.",
        confidence: 1,
        match_reason: "distinct_alias",
      },
      {
        skill: "Kubernetes",
        category: "infra",
        requirement_type: "preferred",
        evidence_text: "Kubernetes 운영 경험",
        confidence: 1,
        match_reason: "distinct_alias",
      },
    ],
  },
};

const detailId = pathname.match(/^\/api\/postings\/([^/]+)$/)?.[1];
const body = detailId
  ? postingDetails[detailId] ?? null
  : pathname === "/api/postings"
    ? postings
    : pathname === "/api/skills/stats"
      ? skillStats
      : null;
```

- [ ] **Step 2: Write responsive detail browser tests**

```ts
import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 600, 390]) {
  test(`keeps verified job detail usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width });
    await page.addInitScript(() => {
      localStorage.setItem("ejik-fit:owned-skills", JSON.stringify(["Python"]));
    });
    await page.goto("/jobs");
    await page.getByRole("link", { name: "Python Backend Engineer" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Python Backend Engineer" }),
    ).toBeVisible();
    await expect(page.getByText("내 기술과 겹침 1개")).toBeVisible();
    await expect(page.getByRole("heading", { name: "주요 업무" })).toBeVisible();

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

    await save.click();
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Python Backend Engineer 저장 해제",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    if (width === 390) {
      const panel = await page.getByRole("region", { name: "지원 준비" }).boundingBox();
      const navigation = await page
        .getByRole("navigation", { name: "모바일 주요 탐색" })
        .boundingBox();
      expect(panel).not.toBeNull();
      expect(navigation).not.toBeNull();
      expect(
        panel!.y + panel!.height <= navigation!.y || panel!.y >= navigation!.y + navigation!.height,
      ).toBe(true);
    }
  });
}
```

- [ ] **Step 3: Run the new browser test and then the full browser suite**

Run: `npx playwright test e2e/job-detail.e2e.ts`

Run: `npm run test:e2e`

Expected: all detail and existing shell/jobs/career tests PASS.

Restore `apps/web/next-env.d.ts` to `import "./.next/types/routes.d.ts";` if the development server changes it.

```bash
git add apps/web/e2e/fixtures/test-api.mjs apps/web/e2e/job-detail.e2e.ts apps/web/next-env.d.ts
git commit -m "test: cover verified job detail in browser"
```

---

### Task 5: Review and Deployment Verification

**Files:**
- Modify only files required by actionable review findings.

**Interfaces:**
- Consumes: the completed job-detail branch.
- Produces: a clean, reviewed branch ready for a fast-forward merge to `main`.

- [ ] **Step 1: Run focused verification**

Run:

```bash
npm test -- --run src/app/jobs/[id]/page.test.tsx src/features/jobs/job-detail-model.test.ts src/features/jobs/job-detail-actions.test.tsx
npx tsc --noEmit
npx playwright test e2e/job-detail.e2e.ts
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Review the full branch diff**

Check for unsafe URL use, invented data, duplicated live announcements, storage failure optimism, inaccessible heading order, less-than-44px targets, sticky/mobile navigation overlap, and accidental rendering of `description_html`.

- [ ] **Step 3: Run the complete repository verification**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -q packages/backend/tests
cd apps/web && npm test -- --run
cd apps/web && npm run test:e2e
cd apps/web && npx tsc --noEmit
cd apps/web && npm run lint
cd apps/web && npm audit --omit=dev
/root/work/ejik-fit/.venv/bin/alembic -c packages/backend/alembic.ini upgrade head --sql >/tmp/ejikfit-job-detail-migration.sql
cd apps/web && VERCEL=1 VERCEL_ENV=production VERCEL_PROJECT_PRODUCTION_URL=ejik-fit-web.vercel.app API_BASE_URL=https://ejik-fit-api.vercel.app npm run build
```

Expected: backend, web, Playwright, TypeScript, lint, audit, migration SQL, and production build all exit 0.

- [ ] **Step 4: Merge, push, and verify production**

Fast-forward `feat/job-detail` into `main`, push `origin main`, watch GitHub CI, and wait for both Vercel web and API commit statuses to succeed. In production, open an actual posting at 1440px and 390px, verify no horizontal overflow or console errors, confirm an official logo or initials fallback, save/reload behavior, owned-skill overlap, parsed description headings, and official link target.
