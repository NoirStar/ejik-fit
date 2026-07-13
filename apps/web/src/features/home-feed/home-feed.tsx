"use client";

import {
  ArrowRight,
  ArrowSquareOut,
  BookmarkSimple,
  Briefcase,
  ChartLineUp,
  ChatCircle,
  CheckCircle,
  Heart,
  MapPin,
  NotePencil,
  ShieldCheck,
  Stack,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CompanyMark } from "./company-mark";
import { trapTabKey } from "@/lib/focus-trap";
import {
  EMPTY_SOCIAL_INTERACTIONS,
  readSocialInteractions,
  subscribeSocialInteractions,
  togglePostReaction,
  togglePostSave,
  type SocialInteractions,
} from "@/lib/social-interactions";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import { itemsForTab } from "./feed-order";
import { MOCK_COMMUNITY_POSTS, MOCK_SOCIAL_ITEMS } from "./mock-community";
import styles from "./home-feed.module.css";
import type {
  CommunityPostFeedItem,
  FeedItem,
  FeedTab,
  HomeFeedSnapshot,
  InterviewReviewFeedItem,
  MarketInsightFeedItem,
  RecommendedJobFeedItem,
} from "./types";

export type HomeFeedProps = {
  snapshot: HomeFeedSnapshot;
  composeInitiallyOpen?: boolean;
};

type LocalPostDraft = {
  title: string;
  body: string;
  tags: string;
};
type DraftErrors = Partial<Record<"title" | "body", string>>;
type SocialItem = CommunityPostFeedItem | InterviewReviewFeedItem;

const TABS: Array<{ id: FeedTab; label: string }> = [
  { id: "recommended", label: "추천" },
  { id: "following", label: "팔로잉" },
  { id: "latest", label: "최신" },
  { id: "popular", label: "인기" },
];

const EMPTY_DRAFT: LocalPostDraft = { title: "", body: "", tags: "" };

function isSocialItem(item: FeedItem): item is SocialItem {
  return item.type === "community_post" || item.type === "interview_review";
}

function localPostId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}`;
}

function parseTags(value: string) {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of value.split(",")) {
    const tag = rawTag.trim();
    const key = tag.toLocaleLowerCase("ko-KR");
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === 4) break;
  }

  return tags;
}

function formatVerificationDate(value: string | null) {
  if (!value) return "확인 시각 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 시각 없음";

  const parts = new Intl.DateTimeFormat("en-US-u-nu-latn", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Seoul",
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const month = valueByType.get("month");
  const day = valueByType.get("day");
  const hour = valueByType.get("hour");
  const minute = valueByType.get("minute");

  if (!month || !day || !hour || !minute) return "확인 시각 없음";
  return `${Number(month)}월 ${Number(day)}일 ${hour}:${minute}`;
}

function SocialCard({
  item,
  localCommentCount,
  onReact,
  onSave,
  reacted,
  saved,
}: {
  item: SocialItem;
  localCommentCount: number;
  onReact(): void;
  onSave(): void;
  reacted: boolean;
  saved: boolean;
}) {
  const titleId = `feed-${item.id}-title`;
  const body = item.type === "community_post" ? item.body : item.summary;

  return (
    <article aria-labelledby={titleId} className={styles.socialCard}>
      <header className={styles.authorRow}>
        <span className={styles.authorAvatar} data-tone={item.authorTone}>
          {item.authorName.slice(0, 1)}
        </span>
        <div className={styles.authorCopy}>
          <strong>{item.authorName}</strong>
          <span>{item.authorHeadline}</span>
        </div>
        <div className={styles.postContext}>
          <strong>{item.category}</strong>
          <span>{item.createdLabel}</span>
        </div>
      </header>

      {item.type === "interview_review" && (
        <div className={styles.reviewMeta}>
          <span>{item.companyType}</span>
          <span>{item.role}</span>
          <span>{item.stage}</span>
        </div>
      )}

      <div className={styles.cardCopy}>
        <h2 id={titleId}>
          <Link href={item.href}>{item.title}</Link>
        </h2>
        <p>{body}</p>
      </div>

      <ul aria-label={`${item.title} 태그`} className={styles.tags}>
        {item.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>

      <footer className={styles.cardActions}>
        <button
          aria-label={`${item.title} ${reacted ? "공감 취소" : "공감"}`}
          aria-pressed={reacted}
          data-active={reacted ? "true" : undefined}
          onClick={onReact}
          type="button"
        >
          <Heart aria-hidden="true" size={19} weight={reacted ? "fill" : "regular"} />
          <span>공감</span>
          <strong>{item.metrics.reactions + (reacted ? 1 : 0)}</strong>
        </button>
        <Link
          aria-label={`${item.title} 댓글 ${item.metrics.comments + localCommentCount}개`}
          href={item.href}
        >
          <ChatCircle aria-hidden="true" size={19} />
          <span>댓글</span>
          <strong>{item.metrics.comments + localCommentCount}</strong>
        </Link>
        <button
          aria-label={`${item.title} ${saved ? "저장 해제" : "저장"}`}
          aria-pressed={saved}
          className={styles.saveAction}
          data-active={saved ? "true" : undefined}
          onClick={onSave}
          type="button"
        >
          <BookmarkSimple
            aria-hidden="true"
            size={19}
            weight={saved ? "fill" : "regular"}
          />
          <span>저장</span>
          <strong>{item.metrics.saves + (saved ? 1 : 0)}</strong>
        </button>
      </footer>
    </article>
  );
}

function JobCard({
  item,
  onSave,
  ownedSkills,
  saved,
}: {
  item: RecommendedJobFeedItem;
  onSave(): void;
  ownedSkills: string[];
  saved: boolean;
}) {
  const titleId = `feed-${item.id}-title`;
  const hasEvidence =
    item.matchedRequiredSkills.length > 0 ||
    item.missingRequiredSkills.length > 0 ||
    item.matchedPreferredSkills.length > 0;

  return (
    <article aria-labelledby={titleId} className={styles.jobCard}>
      <div className={styles.jobTopline}>
        <span className={styles.verifiedBadge}>
          <ShieldCheck aria-hidden="true" size={16} weight="fill" />
          공식 공고
        </span>
        <span>{item.verifiedLabel} 확인</span>
      </div>

      <div className={styles.jobIdentity}>
        <CompanyMark companyName={item.companyName} sourceUrl={item.sourceUrl} size={52} />
        <div>
          <p>{item.companyName}</p>
          <h2 id={titleId}>
            <Link href={item.href}>{item.title}</Link>
          </h2>
        </div>
      </div>

      <div className={styles.jobMeta}>
        <span>
          <MapPin aria-hidden="true" size={16} />
          {item.location}
        </span>
        <span>{item.careerLabel}</span>
        <span>{item.employmentLabel}</span>
      </div>

      {ownedSkills.length === 0 ? (
        <p className={styles.stackPrompt}>내 스택을 추가하면 일치 공고를 계산합니다.</p>
      ) : hasEvidence ? (
        <div className={styles.skillEvidence}>
          {item.matchedRequiredSkills.map((skill) => (
            <span data-kind="matched" key={`matched-${skill}`}>
              <CheckCircle aria-hidden="true" size={15} weight="fill" />
              보유 필수 {skill}
            </span>
          ))}
          {item.missingRequiredSkills.map((skill) => (
            <span data-kind="missing" key={`missing-${skill}`}>
              확인 필요 {skill}
            </span>
          ))}
          {item.matchedPreferredSkills.map((skill) => (
            <span data-kind="preferred" key={`preferred-${skill}`}>
              보유 우대 {skill}
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.stackPrompt}>이 공고의 기술 근거가 그래프 응답에 없습니다.</p>
      )}

      <footer className={styles.jobActions}>
        <Link href={item.href}>
          공고 상세
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
        <a href={item.sourceUrl} rel="noreferrer" target="_blank">
          공식 원문
          <ArrowSquareOut aria-hidden="true" size={15} />
        </a>
        <button
          aria-label={`${item.title} 저장`}
          aria-pressed={saved}
          data-active={saved ? "true" : undefined}
          onClick={onSave}
          type="button"
        >
          <BookmarkSimple
            aria-hidden="true"
            size={19}
            weight={saved ? "fill" : "regular"}
          />
          <span>저장</span>
        </button>
      </footer>
    </article>
  );
}

function MarketCard({ item }: { item: MarketInsightFeedItem }) {
  const titleId = `feed-${item.id}-title`;

  return (
    <article aria-labelledby={titleId} className={styles.marketCard}>
      <div className={styles.marketIcon}>
        <ChartLineUp aria-hidden="true" size={21} weight="bold" />
      </div>
      <div className={styles.marketBody}>
        <div className={styles.marketTopline}>
          <span>채용 시장 인사이트</span>
          <small>{item.sourceLabel}</small>
        </div>
        <h2 id={titleId}>
          <Link href={item.href}>{item.title}</Link>
        </h2>
        <p>{item.summary}</p>
        <div aria-label={`${item.skillName} 채용 수요`} className={styles.marketCounts}>
          <strong>{item.sampleLabel}</strong>
          <span>필수 {item.requiredCount}건</span>
          <span>우대 {item.preferredCount}건</span>
        </div>
        <Link className={styles.marketLink} href={item.href}>
          스킬맵에서 공고 근거 보기
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </article>
  );
}

function FeedCard({
  item,
  localCommentCount,
  onReact,
  onSave,
  ownedSkills,
  reacted,
  saved,
}: {
  item: FeedItem;
  localCommentCount: number;
  onReact(): void;
  onSave(): void;
  ownedSkills: string[];
  reacted: boolean;
  saved: boolean;
}) {
  if (isSocialItem(item)) {
    return (
      <SocialCard
        item={item}
        localCommentCount={localCommentCount}
        onReact={onReact}
        onSave={onSave}
        reacted={reacted}
        saved={saved}
      />
    );
  }

  if (item.type === "recommended_job") {
    return (
      <JobCard item={item} onSave={onSave} ownedSkills={ownedSkills} saved={saved} />
    );
  }

  return <MarketCard item={item} />;
}

export function HomeFeed({
  composeInitiallyOpen = false,
  snapshot,
}: HomeFeedProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>("recommended");
  const [socialInteractions, setSocialInteractions] =
    useState<SocialInteractions>(EMPTY_SOCIAL_INTERACTIONS);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [localPosts, setLocalPosts] = useState<CommunityPostFeedItem[]>([]);
  const [composerOpen, setComposerOpen] = useState(composeInitiallyOpen);
  const [draft, setDraft] = useState<LocalPostDraft>(EMPTY_DRAFT);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [announcement, setAnnouncement] = useState("");
  const composerButtonRef = useRef<HTMLButtonElement>(null);
  const composerTitleRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setSavedJobIds(readSavedJobIds());
    return subscribeSavedJobs(setSavedJobIds);
  }, []);

  useEffect(() => {
    setSocialInteractions(readSocialInteractions());
    return subscribeSocialInteractions(setSocialInteractions);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setDraftErrors({});
    composerButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!composerOpen) return;
    composerTitleRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      trapTabKey(event, composerRef.current);
      if (event.key === "Escape") {
        event.preventDefault();
        closeComposer();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeComposer, composerOpen]);

  const visibleItems = useMemo(
    () => itemsForTab([...localPosts, ...snapshot.feedItems], activeTab),
    [activeTab, localPosts, snapshot.feedItems],
  );

  function openComposer() {
    setDraftErrors({});
    setAnnouncement("");
    setComposerOpen(true);
  }

  function handleTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.id);
    document.getElementById(`feed-tab-${nextTab.id}`)?.focus();
  }

  function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();
    const nextErrors: DraftErrors = {};
    if (!title) nextErrors.title = "제목을 입력해 주세요.";
    if (!body) nextErrors.body = "내용을 입력해 주세요.";

    if (Object.keys(nextErrors).length > 0) {
      setDraftErrors(nextErrors);
      return;
    }

    const id = localPostId();
    const post: CommunityPostFeedItem = {
      id,
      type: "community_post",
      category: "업무 이야기",
      authorName: "나",
      authorHeadline: "이 브라우저에서 작성",
      authorTone: "violet",
      isFollowing: true,
      createdAt: new Date().toISOString(),
      createdLabel: "방금 전",
      title,
      body,
      tags: parseTags(draft.tags),
      href: `#${id}`,
      metrics: { reactions: 0, comments: 0, saves: 0 },
      source: "local",
    };

    setLocalPosts((current) => [post, ...current]);
    setActiveTab("recommended");
    setDraft(EMPTY_DRAFT);
    setDraftErrors({});
    setComposerOpen(false);
    setAnnouncement("작성한 글을 피드 맨 위에 추가했습니다.");
    composerButtonRef.current?.focus();
  }

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <aside aria-label="내 커리어 바로가기" className={styles.leftRail}>
          <section className={styles.railCard} id="my-stack">
            <div className={styles.railIconTitle}>
              <Stack aria-hidden="true" size={19} weight="bold" />
              <h2>내 커리어 기준</h2>
            </div>
            {snapshot.ownedSkills.length > 0 ? (
              <ul aria-label="내 기술" className={styles.ownedSkills}>
                {snapshot.ownedSkills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.railEmpty}>
                기술을 고르면 관련 공식 공고의 요구 조건과 비교할 수 있습니다.
              </p>
            )}
            <p className={styles.railHint}>선택한 기술은 이 브라우저에만 저장됩니다.</p>
            <Link className={styles.textLink} href="/career">
              설정 방식 보기 <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </section>

          <section className={styles.railCard}>
            <h2>바로가기</h2>
            <nav aria-label="커리어 도구" className={styles.shortcutList}>
              <Link href="/jobs">
                <Briefcase aria-hidden="true" size={18} />
                공식 공고 찾기
              </Link>
              <Link href="/skill-map">
                <ChartLineUp aria-hidden="true" size={18} />
                스킬 연결 보기
              </Link>
              <Link href="/data-policy">
                <ShieldCheck aria-hidden="true" size={18} />
                데이터 기준
              </Link>
            </nav>
          </section>

          <section className={styles.railCard}>
            <h2>최근 본 주제</h2>
            <ul className={styles.recentTopics}>
              {MOCK_COMMUNITY_POSTS.slice(0, 4).map((post) => (
                <li key={post.id}>
                  <Link href={post.href}># {post.tags[0]}</Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section aria-labelledby="home-feed-title" className={styles.feedColumn}>
          <header className={styles.feedHeader}>
            <div>
              <p className={styles.eyebrow}>커뮤니티 예시 + 공식 채용 데이터</p>
              <h1 id="home-feed-title">내 커리어와 가까운 이야기</h1>
              <p>현업의 고민과 면접 경험 사이에 확인 가능한 공고 근거를 함께 놓았습니다.</p>
            </div>
            <button
              className={styles.composeButton}
              onClick={openComposer}
              ref={composerButtonRef}
              type="button"
            >
              <NotePencil aria-hidden="true" size={18} weight="bold" />
              커뮤니티 글쓰기
            </button>
          </header>

          {snapshot.dataStatus !== "ready" && (
            <section className={styles.dataNotice} role="status">
              <WarningCircle aria-hidden="true" size={20} weight="fill" />
              <div>
                <strong>
                  {snapshot.dataStatus === "partial"
                    ? "일부 실데이터를 불러오지 못했습니다"
                    : snapshot.dataStatus === "empty"
                      ? "현재 표시할 실데이터가 없습니다"
                      : "실데이터를 불러오지 못했습니다"}
                </strong>
                <p>커뮤니티 예시 콘텐츠는 계속 볼 수 있으며, 수치를 임의로 채우지 않습니다.</p>
                {snapshot.resourceErrors.length > 0 && (
                  <ul aria-label="데이터 오류">
                    {snapshot.resourceErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
                <button onClick={() => window.location.reload()} type="button">
                  데이터 다시 불러오기
                </button>
              </div>
            </section>
          )}

          <div aria-label="피드 정렬" className={styles.tabs} role="tablist">
            {TABS.map((tab, index) => (
              <button
                aria-controls="home-feed-panel"
                aria-selected={activeTab === tab.id}
                data-active={activeTab === tab.id ? "true" : undefined}
                id={`feed-tab-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                role="tab"
                tabIndex={activeTab === tab.id ? 0 : -1}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p aria-live="polite" className={styles.srOnly}>
            {`${visibleItems.length}개의 글을 표시합니다.`}
          </p>
          {announcement && (
            <p aria-live="polite" className={styles.confirmation} role="status">
              <CheckCircle aria-hidden="true" size={17} weight="fill" />
              {announcement}
            </p>
          )}

          <div
            aria-labelledby={`feed-tab-${activeTab}`}
            className={styles.feedList}
            id="home-feed-panel"
            role="tabpanel"
          >
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => {
                const recommendedJob = item.type === "recommended_job";
                return (
                  <FeedCard
                    item={item}
                    key={item.id}
                    localCommentCount={
                      socialInteractions.commentsByPostId[item.id]?.length ?? 0
                    }
                    onReact={() =>
                      setSocialInteractions(togglePostReaction(item.id))
                    }
                    onSave={() => {
                      if (recommendedJob) {
                        setSavedJobIds(toggleSavedJob(item.postingId));
                      } else {
                        setSocialInteractions(togglePostSave(item.id));
                      }
                    }}
                    ownedSkills={snapshot.ownedSkills}
                    reacted={socialInteractions.reactedPostIds.includes(item.id)}
                    saved={
                      recommendedJob
                        ? savedJobIds.includes(item.postingId)
                        : socialInteractions.savedPostIds.includes(item.id)
                    }
                  />
                );
              })
            ) : (
              <div className={styles.emptyFeed}>
                <strong>이 탭에 표시할 글이 없습니다.</strong>
                <p>다른 탭을 선택하거나 첫 글을 작성해 보세요.</p>
              </div>
            )}
          </div>
        </section>

        <aside aria-label="채용 시장 요약" className={styles.rightRail}>
          <section className={styles.railCard}>
            <div className={styles.railHeadingRow}>
              <h2>오늘의 인기 주제</h2>
              <span>예시</span>
            </div>
            <ol className={styles.popularTopics}>
              {MOCK_SOCIAL_ITEMS.slice(0, 5).map((item, index) => (
                <li key={item.id}>
                  <span>{index + 1}</span>
                  <Link href={item.href}>{item.title}</Link>
                  <small>{item.metrics.comments}</small>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.railCard} id="market-insights">
            <div className={styles.railHeadingRow}>
              <h2>주목할 기술 수요</h2>
              <Link href="/market">더보기</Link>
            </div>
            {snapshot.skillDemand.length > 0 ? (
              <ol className={styles.skillDemand}>
                {snapshot.skillDemand.map((skill) => (
                  <li key={skill.skillName}>
                    <Link href={`/skill-map?skill=${encodeURIComponent(skill.skillName)}`}>
                      <strong>{skill.skillName}</strong>
                      <span>{skill.postingCount}건</span>
                      <small>
                        필수 {skill.requiredCount} · 우대 {skill.preferredCount}
                      </small>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.railEmpty}>확인된 기술 수요가 없습니다.</p>
            )}
            <p className={styles.railFootnote}>공식 공고 표본의 기술 언급 건수입니다.</p>
          </section>

          <section className={styles.trustCard}>
            <div className={styles.railIconTitle}>
              <ShieldCheck aria-hidden="true" size={19} weight="fill" />
              <h2>검증 범위</h2>
            </div>
            <dl>
              <div>
                <dt>표시 공고</dt>
                <dd>{snapshot.postingCount}건</dd>
              </div>
              <div>
                <dt>공식 출처</dt>
                <dd>{snapshot.sourceCount}곳</dd>
              </div>
              <div>
                <dt>마지막 확인</dt>
                <dd>{formatVerificationDate(snapshot.lastVerifiedAt)}</dd>
              </div>
            </dl>
            <Link className={styles.textLink} href="/data-policy">
              수집 기준 확인 <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </section>
        </aside>
      </div>

      {composerOpen && (
        <div className={styles.composerBackdrop} onMouseDown={closeComposer}>
          <section
            aria-labelledby="community-composer-title"
            aria-modal="true"
            className={styles.composer}
            onMouseDown={(event) => event.stopPropagation()}
            ref={composerRef}
            role="dialog"
          >
            <header className={styles.composerHeader}>
              <div>
                <p>브라우저에서만 유지되는 예시 글</p>
                <h2 id="community-composer-title">커뮤니티 글쓰기</h2>
              </div>
              <button aria-label="글쓰기 닫기" onClick={closeComposer} type="button">
                <X aria-hidden="true" size={20} weight="bold" />
              </button>
            </header>

            <form className={styles.composerForm} onSubmit={submitPost}>
              <label htmlFor="community-post-title">제목</label>
              <input
                aria-describedby={draftErrors.title ? "community-post-title-error" : undefined}
                aria-invalid={Boolean(draftErrors.title)}
                id="community-post-title"
                maxLength={80}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="함께 나누고 싶은 커리어 고민"
                ref={composerTitleRef}
                value={draft.title}
              />
              {draftErrors.title && (
                <p id="community-post-title-error" role="alert">
                  {draftErrors.title}
                </p>
              )}

              <label htmlFor="community-post-body">내용</label>
              <textarea
                aria-describedby={draftErrors.body ? "community-post-body-error" : undefined}
                aria-invalid={Boolean(draftErrors.body)}
                id="community-post-body"
                maxLength={1200}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, body: event.target.value }))
                }
                placeholder="상황과 궁금한 점을 구체적으로 적어주세요."
                rows={7}
                value={draft.body}
              />
              {draftErrors.body && (
                <p id="community-post-body-error" role="alert">
                  {draftErrors.body}
                </p>
              )}

              <label htmlFor="community-post-tags">태그 (선택)</label>
              <input
                id="community-post-tags"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="쉼표로 구분, 최대 4개"
                value={draft.tags}
              />

              <div className={styles.composerNote}>
                <ShieldCheck aria-hidden="true" size={18} />
                <p>데모 글은 서버에 게시되지 않으며 새로고침하면 사라집니다.</p>
              </div>

              <div className={styles.composerActions}>
                <button onClick={closeComposer} type="button">
                  취소
                </button>
                <button type="submit">피드에 올리기</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
