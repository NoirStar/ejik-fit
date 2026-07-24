# Community Tag Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every allowed community tag as the same search link and remove the non-interactive `+1` chip.

**Architecture:** Keep tag rendering inside `SocialCard`; the database contract already limits posts to four tags. Use the existing wrapped list and touch-target pseudo-element, adding only a width guard for long labels.

**Tech Stack:** React 19, CSS Modules, Testing Library, Vitest

## Global Constraints

- Keep `MAX_COMMUNITY_POST_TAGS` at exactly `4`.
- Every tag remains a community-search link with a 44px interaction target.
- Do not add a tag expander or another button.
- Long labels must not make the feed wider than its container.

---

### Task 1: Render all four tags consistently

**Files:**
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Test: `apps/web/src/features/home-feed/home-feed.test.tsx`

**Interfaces:**
- Consumes: `SocialItem.tags: string[]`, already bounded by `MAX_COMMUNITY_POST_TAGS` at persistence boundaries.
- Produces: one `Link` per item in `item.tags`; no `moreTag` element or style.

- [ ] **Step 1: Write the failing component test**

Add a server post whose tags are `['백엔드', 'Kubernetes', '성능 최적화', '아주 긴 기술 태그 이름']`, render it through `HomeFeed`, and assert:

```tsx
const article = await screen.findByRole("article", { name: post.title });
const tags = within(article).getByRole("list", { name: `${post.title} 태그` });
expect(within(tags).getAllByRole("link")).toHaveLength(4);
expect(within(tags).getByRole("link", {
  name: "아주 긴 기술 태그 이름 커뮤니티 검색",
})).toHaveAttribute(
  "href",
  "/search?q=%EC%95%84%EC%A3%BC+%EA%B8%B4+%EA%B8%B0%EC%88%A0+%ED%83%9C%EA%B7%B8+%EC%9D%B4%EB%A6%84&scope=community",
);
expect(within(tags).queryByText("+1")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify the current truncation fails**

Run: `npm test -- --run src/features/home-feed/home-feed.test.tsx`

Expected: FAIL because only three tag links are rendered and `+1` remains.

- [ ] **Step 3: Remove tag truncation and constrain link width**

Replace the derived tag variables and list body with:

```tsx
{item.tags.map((tag) => (
  <li key={tag}>
    <Link
      aria-label={`${tag} 커뮤니티 검색`}
      href={buildSearchScopeHref(tag, "community")}
      prefetch={false}
      title={tag}
    >
      <span>{tag}</span>
    </Link>
  </li>
))}
```

Add the following width rules and delete `.moreTag`:

```css
.tags li {
  min-width: 0;
  max-width: 100%;
}

.tags a {
  max-width: 100%;
}

.tags a span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts`

Expected: PASS with four links and no `+1` style reference.

- [ ] **Step 5: Commit the independently testable change**

```bash
git add apps/web/src/features/home-feed/home-feed.tsx apps/web/src/features/home-feed/home-feed.module.css apps/web/src/features/home-feed/home-feed.test.tsx
git commit -m "fix: show every community post tag"
```
