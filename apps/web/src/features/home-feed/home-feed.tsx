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
  ShieldCheck,
  Stack,
  Trash,
  UserCheck,
  UserPlus,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuthViewerContext } from "@/features/auth/auth-viewer-context";
import type { CommunityStore } from "@/features/community/community-store";
import { useCommunityFeed } from "@/features/community/use-community-feed";
import { buildSearchScopeHref } from "@/features/search/model";
import { trapTabKey } from "@/lib/focus-trap";
import {
  createLocalCommunityPost,
  DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY,
  deleteLocalCommunityPost,
  readLocalCommunityPosts,
  subscribeLocalCommunityPosts,
  type LocalCommunityPost,
  type LocalCommunityPostCategory,
} from "@/lib/local-community-posts";
import {
  EMPTY_SOCIAL_INTERACTIONS,
  readSocialInteractions,
  subscribeSocialInteractions,
  toggleAuthorFollow,
  togglePostReaction,
  togglePostSave,
  type SocialInteractions,
} from "@/lib/social-interactions";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import { removeRecentCommunityTopic } from "@/lib/recent-community-topics";

import { CompanyMark } from "./company-mark";
import { itemsForTab } from "./feed-order";
import { FollowingPostList } from "./following-post-list";
import {
  localCommunityPostToFeedItem,
  serverCommunityPostToFeedItem,
} from "./model";
import { MOCK_SOCIAL_ITEMS } from "./mock-community";
import { RecentTopicList } from "./recent-topic-list";
import styles from "./home-feed.module.css";
import type {
  CareerContextSummary,
  CareerInsightSummary,
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
  communityStore?: CommunityStore;
};

type LocalPostDraft = {
  category: LocalCommunityPostCategory;
  title: string;
  body: string;
  tags: string;
};
type DraftErrors = Partial<Record<"title" | "body" | "storage", string>>;
type SocialItem = CommunityPostFeedItem | InterviewReviewFeedItem;

const TABS: Array<{
  id: FeedTab;
  label: string;
  unconfiguredLabel?: string;
}> = [
  { id: "recommended", label: "추천", unconfiguredLabel: "둘러보기" },
  { id: "following", label: "팔로잉" },
  { id: "latest", label: "최신" },
  { id: "popular", label: "인기" },
];

const POST_KIND_OPTIONS: ReadonlyArray<{
  label: string;
  value: LocalCommunityPostCategory;
}> = [
  { label: "질문", value: "커리어 질문" },
  { label: "커리어 고민", value: "커리어 고민" },
  { label: "면접 후기", value: "면접 후기" },
];

const EMPTY_DRAFT: LocalPostDraft = {
  category: DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY,
  title: "",
  body: "",
  tags: "",
};

function draftTags(value: string) {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.split(",")) {
    const tag = candidate.trim();
    const key = tag.toLocaleLowerCase("ko-KR");
    if (!tag || seen.has(key)) continue;
    tags.push(tag);
    seen.add(key);
    if (tags.length === 4) break;
  }
  return tags;
}

function isSocialItem(item: FeedItem): item is SocialItem {
  return item.type === "community_post" || item.type === "interview_review";
}

function SocialCard({
  actionDisabled,
  canDelete,
  item,
  followDisabled,
  followed,
  localCommentCount,
  onDelete,
  onFollow,
  onReact,
  onSave,
  reacted,
  saved,
}: {
  actionDisabled: boolean;
  canDelete: boolean;
  item: SocialItem;
  followDisabled: boolean;
  followed: boolean;
  localCommentCount: number;
  onDelete(): void;
  onFollow(): void;
  onReact(): void;
  onSave(): void;
  reacted: boolean;
  saved: boolean;
}) {
  const titleId = `feed-${item.id}-title`;
  const body = item.type === "community_post" ? item.body : item.summary;
  const visibleTags = item.tags.slice(0, 3);
  const hiddenTagCount = item.tags.length - visibleTags.length;
  const persistedMetrics = item.source === "server";
  const reactionCount =
    item.metrics.reactions + (persistedMetrics ? 0 : reacted ? 1 : 0);
  const commentCount =
    item.metrics.comments + (persistedMetrics ? 0 : localCommentCount);
  const saveCount = item.metrics.saves + (persistedMetrics ? 0 : saved ? 1 : 0);

  return (
    <article aria-labelledby={titleId} className={styles.socialCard}>
      <header className={styles.authorRow}>
        <span className={styles.authorAvatar} data-tone={item.authorTone}>
          {item.authorName.slice(0, 1)}
        </span>
        <div className={styles.authorCopy}>
          <strong>{item.authorName}</strong>
          <span>
            {item.authorHeadline} · {item.createdLabel}
          </span>
        </div>
        <div className={styles.authorActions}>
          {item.source === "local" || canDelete ? (
            <button
              aria-label={`${item.title} 삭제`}
              className={styles.localDeleteButton}
              disabled={actionDisabled}
              onClick={onDelete}
              type="button"
            >
              <Trash aria-hidden="true" size={15} />
              삭제
            </button>
          ) : (
            <button
              aria-label={`${item.authorName} ${followed ? "팔로우 해제" : "팔로우"}`}
              aria-pressed={followed}
              className={styles.followButton}
              data-active={followed ? "true" : undefined}
              disabled={followDisabled}
              onClick={onFollow}
              type="button"
            >
              {followed ? (
                <UserCheck aria-hidden="true" size={15} weight="fill" />
              ) : (
                <UserPlus aria-hidden="true" size={15} weight="bold" />
              )}
              {followed ? "팔로잉" : "팔로우"}
            </button>
          )}
        </div>
      </header>

      <div className={styles.cardCopy}>
        <div className={styles.postTitleRow}>
          <span className={styles.categoryLabel}>{item.category}</span>
          <h2 id={titleId}>
            <Link href={item.href} prefetch={false}>
              {item.title}
            </Link>
          </h2>
        </div>
        {item.type === "interview_review" && (
          <div className={styles.reviewMeta}>
            <span>{item.companyType}</span>
            <span>{item.role}</span>
            <span>{item.stage}</span>
          </div>
        )}
        <p>{body}</p>
      </div>

      <ul aria-label={`${item.title} 태그`} className={styles.tags}>
        {visibleTags.map((tag) => (
          <li key={tag}>
            <Link
              aria-label={`${tag} 커뮤니티 검색`}
              href={buildSearchScopeHref(tag, "community")}
              prefetch={false}
            >
              {tag}
            </Link>
          </li>
        ))}
        {hiddenTagCount > 0 && (
          <li
            aria-label={`태그 ${hiddenTagCount}개 더 있음`}
            className={styles.moreTag}
          >
            +{hiddenTagCount}
          </li>
        )}
      </ul>

      <footer className={styles.cardActions}>
        <button
          aria-label={`${item.title} ${reacted ? "공감 취소" : "공감"}`}
          aria-pressed={reacted}
          data-active={reacted ? "true" : undefined}
          disabled={actionDisabled}
          onClick={onReact}
          type="button"
        >
          <Heart aria-hidden="true" size={19} weight={reacted ? "fill" : "regular"} />
          <span>공감</span>
          <strong>{reactionCount}</strong>
        </button>
        <Link
          aria-label={`${item.title} 댓글 ${commentCount}개`}
          href={item.href}
          prefetch={false}
        >
          <ChatCircle aria-hidden="true" size={19} />
          <span>댓글</span>
          <strong>{commentCount}</strong>
        </Link>
        <button
          aria-label={`${item.title} ${saved ? "저장 해제" : "저장"}`}
          aria-pressed={saved}
          className={styles.saveAction}
          data-active={saved ? "true" : undefined}
          disabled={actionDisabled}
          onClick={onSave}
          type="button"
        >
          <BookmarkSimple
            aria-hidden="true"
            size={19}
            weight={saved ? "fill" : "regular"}
          />
          <span>저장</span>
          <strong>{saveCount}</strong>
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
          공식 채용 공고
        </span>
        <span>{item.verifiedLabel} 확인</span>
      </div>

      <div className={styles.jobIdentity}>
        <CompanyMark
          companyName={item.companyName}
          priority
          size={52}
          sourceUrl={item.sourceUrl}
        />
        <div>
          <p>
            {item.companyHref ? (
              <Link
                aria-label={`${item.companyName} 기업 채용 현황`}
                className={styles.companyLink}
                href={item.companyHref}
                prefetch={false}
              >
                {item.companyName}
              </Link>
            ) : (
              item.companyName
            )}
          </p>
          <h2 id={titleId}>
            <Link href={item.href} prefetch={false}>
              {item.title}
            </Link>
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
        <div className={styles.stackPrompt}>
          <span>내 스택을 추가하면 일치 공고를 계산합니다.</span>
          <Link href="/career">내 기술 추가</Link>
        </div>
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
        <Link href={item.href} prefetch={false}>
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
          <Link href={item.href} prefetch={false}>
            {item.title}
          </Link>
        </h2>
        <p>{item.summary}</p>
        <div aria-label={`${item.skillName} 채용 수요`} className={styles.marketCounts}>
          <strong>{item.sampleLabel}</strong>
          <span>필수 {item.requiredCount}건</span>
          <span>우대 {item.preferredCount}건</span>
          <span>미분류 {item.unspecifiedCount}건</span>
        </div>
        <Link className={styles.marketLink} href={item.href} prefetch={false}>
          스킬맵에서 공고 근거 보기
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </article>
  );
}

function CareerInsightCard({ insight }: { insight: CareerInsightSummary }) {
  const titleId = "home-career-insight-title";

  return (
    <section
      aria-labelledby={titleId}
      className={`${styles.railCard} ${styles.careerInsightCard}`}
    >
      <div className={styles.railHeadingRow}>
        <h2 id={titleId}>내 커리어 인사이트</h2>
        <Link href="/career" prefetch={false}>
          자세히
        </Link>
      </div>

      {insight.status === "needs_skills" ? (
        <div className={styles.careerInsightState}>
          <p>내 스택을 추가하면 현재 공개 공고와 비교할 수 있어요.</p>
          <Link className={styles.textLink} href="/career">
            기술 추가하기 <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
      ) : insight.status === "unavailable" ? (
        <div className={styles.careerInsightState}>
          <p>현재 커리어 비교를 불러오지 못했습니다.</p>
          <Link className={styles.textLink} href="/career">
            내 커리어에서 다시 보기
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.careerCoverage}>
            <span>내 기술과 겹치는 공개 공고</span>
            <strong>{insight.matchingPostingCount.toLocaleString("ko-KR")}건</strong>
            <small>
              필수 기술 절반 이상 {insight.strongFitPostingCount.toLocaleString("ko-KR")}건
            </small>
          </div>

          {insight.nextSkill ? (
            <Link
              aria-label={`${insight.nextSkill.skillName} 근거 보기`}
              className={styles.careerNextSkill}
              href={`/skill-map?skill=${encodeURIComponent(insight.nextSkill.skillName)}`}
              prefetch={false}
            >
              <span>다음 준비 기술</span>
              <strong>{insight.nextSkill.skillName}</strong>
              <small>
                겹치는 공고 {insight.nextSkill.supportingPostingCount.toLocaleString("ko-KR")}건의 부족 요구사항
              </small>
              <em>
                필수 {insight.nextSkill.requiredCount.toLocaleString("ko-KR")} · 우대 {insight.nextSkill.preferredCount.toLocaleString("ko-KR")}
              </em>
              <ArrowRight aria-hidden="true" size={15} weight="bold" />
            </Link>
          ) : (
            <p className={styles.careerNoRecommendation}>
              겹치는 공고에서 반복된 추가 요구 기술이 확인되지 않았습니다.
            </p>
          )}

          <p className={styles.careerInsightFootnote}>
            현재 공개 상태의 공식 채용공고 요구사항만 비교합니다.
          </p>
        </>
      )}
    </section>
  );
}

function HomeCareerContext({
  context,
  ownedSkillCount,
}: {
  context: CareerContextSummary;
  ownedSkillCount: number;
}) {
  const skillAction = ownedSkillCount > 0 ? "기술 관리" : "기술 추가";
  const conditionAction = context.configured ? "조건 수정" : "조건 설정";

  return (
    <section aria-label="내 관심 시장" className={styles.contextBar}>
      <div className={styles.contextIdentity}>
        <span>내 기준</span>
        <h2>
          {context.careerConditionLabel} · {context.targetDomainLabel}
        </h2>
      </div>
      {ownedSkillCount > 0 && (
        <span className={styles.contextSkillCount}>
          내 기술 {ownedSkillCount.toLocaleString("ko-KR")}개
        </span>
      )}
      <Link className={styles.contextAction} href="/career" prefetch={false}>
        {skillAction} · {conditionAction}
        <ArrowRight aria-hidden="true" size={14} weight="bold" />
      </Link>
    </section>
  );
}

function FeedCard({
  actionDisabled,
  canDelete,
  item,
  followDisabled,
  followed,
  localCommentCount,
  onDelete,
  onFollow,
  onReact,
  onSave,
  ownedSkills,
  reacted,
  saved,
}: {
  actionDisabled: boolean;
  canDelete: boolean;
  item: FeedItem;
  followDisabled: boolean;
  followed: boolean;
  localCommentCount: number;
  onDelete(): void;
  onFollow(): void;
  onReact(): void;
  onSave(): void;
  ownedSkills: string[];
  reacted: boolean;
  saved: boolean;
}) {
  if (isSocialItem(item)) {
    return (
      <SocialCard
        actionDisabled={actionDisabled}
        canDelete={canDelete}
        item={item}
        followDisabled={followDisabled}
        followed={followed}
        localCommentCount={localCommentCount}
        onDelete={onDelete}
        onFollow={onFollow}
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
  communityStore,
  snapshot,
}: HomeFeedProps) {
  const { ready: authReady, viewer } = useAuthViewerContext();
  const community = useCommunityFeed({
    authReady,
    store: communityStore,
    viewer,
  });
  const [activeTab, setActiveTab] = useState<FeedTab>("recommended");
  const [socialInteractions, setSocialInteractions] =
    useState<SocialInteractions>(EMPTY_SOCIAL_INTERACTIONS);
  const [socialHydrated, setSocialHydrated] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [localPosts, setLocalPosts] = useState<LocalCommunityPost[]>([]);
  const [localPostsHydrated, setLocalPostsHydrated] = useState(false);
  const [composerOpen, setComposerOpen] = useState(composeInitiallyOpen);
  const [draft, setDraft] = useState<LocalPostDraft>(EMPTY_DRAFT);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [announcement, setAnnouncement] = useState("");
  const composerTitleRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const hasPersonalization =
    snapshot.careerContext.configured || snapshot.ownedSkills.length > 0;

  useEffect(() => {
    setSavedJobIds(readSavedJobIds());
    return subscribeSavedJobs(setSavedJobIds);
  }, []);

  useEffect(() => {
    setSocialInteractions(readSocialInteractions());
    setSocialHydrated(true);
    return subscribeSocialInteractions(setSocialInteractions);
  }, []);

  useEffect(() => {
    setLocalPosts(readLocalCommunityPosts());
    setLocalPostsHydrated(true);
    return subscribeLocalCommunityPosts(setLocalPosts);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setDraftErrors({});
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("compose")) {
        url.searchParams.delete("compose");
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      }
    }
    document.getElementById("global-write-trigger")?.focus();
  }, []);

  useEffect(() => {
    if (composeInitiallyOpen) setComposerOpen(true);
  }, [composeInitiallyOpen]);

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

  const localFeedItems = useMemo(
    () => localPosts.map((post) => localCommunityPostToFeedItem(post)),
    [localPosts],
  );
  const serverFeedItems = useMemo(
    () => community.state.posts.map((post) => serverCommunityPostToFeedItem(post)),
    [community.state.posts],
  );
  const followingRailItems = useMemo(
    () => [...serverFeedItems, ...snapshot.communityItems],
    [serverFeedItems, snapshot.communityItems],
  );
  const followedAuthorIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...socialInteractions.followedAuthorIds,
          ...community.state.viewerState.followedAuthorIds,
        ]),
      ),
    [
      community.state.viewerState.followedAuthorIds,
      socialInteractions.followedAuthorIds,
    ],
  );
  const visibleItems = useMemo(
    () =>
      itemsForTab(
        [...localFeedItems, ...serverFeedItems, ...snapshot.feedItems],
        activeTab,
        followedAuthorIds,
      ),
    [
      activeTab,
      localFeedItems,
      serverFeedItems,
      snapshot.feedItems,
      followedAuthorIds,
    ],
  );

  function requestLoginForCommunity() {
    setAnnouncement("로그인하면 공감·저장·팔로우를 계정에 보관할 수 있습니다.");
  }

  async function handleAuthorFollow(item: SocialItem) {
    if (item.source === "server") {
      if (!viewer) {
        requestLoginForCommunity();
        return;
      }
      const wasFollowed =
        community.state.viewerState.followedAuthorIds.includes(item.authorId);
      const changed = await community.toggleFollowed(item.authorId);
      setAnnouncement(
        changed
          ? `${item.authorName} ${wasFollowed ? "팔로우를 해제했습니다." : "팔로우를 시작했습니다."}`
          : "팔로우 상태를 변경하지 못했습니다. 다시 시도해주세요.",
      );
      return;
    }

    const wasFollowed = socialInteractions.followedAuthorIds.includes(
      item.authorId,
    );
    const next = toggleAuthorFollow(item.authorId);
    const isFollowed = next.followedAuthorIds.includes(item.authorId);
    setSocialInteractions(next);
    if (isFollowed === wasFollowed) {
      setAnnouncement(`${item.authorName} 팔로우 상태를 저장하지 못했습니다.`);
      return;
    }
    setAnnouncement(
      `${item.authorName} ${isFollowed ? "팔로우를 시작했습니다." : "팔로우를 해제했습니다."}`,
    );
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

  function showRecommendedAuthors() {
    setActiveTab("recommended");
    document.getElementById("feed-tab-recommended")?.focus();
  }

  function showFollowingPosts() {
    setActiveTab("following");
    document.getElementById("feed-tab-following")?.focus();
  }

  function deleteLocalPost(post: CommunityPostFeedItem) {
    const result = deleteLocalCommunityPost(post.id);
    setLocalPosts(result.posts);
    if (result.status !== "removed") {
      setAnnouncement(
        result.status === "interactions_failed"
          ? "글의 로컬 반응을 정리하지 못해 삭제를 중단했습니다."
          : "작성한 글을 삭제하지 못했습니다.",
      );
      return;
    }
    removeRecentCommunityTopic(post.id);
    setAnnouncement("작성한 글을 이 브라우저에서 삭제했습니다.");
  }

  async function deleteServerPost(post: CommunityPostFeedItem) {
    const deleted = await community.deletePost(post.id);
    setAnnouncement(
      deleted
        ? "작성한 글을 계정에서 삭제했습니다."
        : "작성한 글을 삭제하지 못했습니다. 다시 시도해주세요.",
    );
  }

  async function handleReaction(item: SocialItem) {
    if (item.source !== "server") {
      setSocialInteractions(togglePostReaction(item.id));
      return;
    }
    if (!viewer) {
      requestLoginForCommunity();
      return;
    }
    const changed = await community.toggleReaction(item.id);
    if (!changed) setAnnouncement("공감을 반영하지 못했습니다. 다시 시도해주세요.");
  }

  async function handleSocialSave(item: SocialItem) {
    if (item.source !== "server") {
      setSocialInteractions(togglePostSave(item.id));
      return;
    }
    if (!viewer) {
      requestLoginForCommunity();
      return;
    }
    const changed = await community.toggleSaved(item.id);
    if (!changed) setAnnouncement("저장 상태를 반영하지 못했습니다. 다시 시도해주세요.");
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
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

    const tags = draftTags(draft.tags);

    if (viewer) {
      const post = await community.createPost({
        category: draft.category,
        title,
        body,
        tags,
      });
      if (!post) {
        setDraftErrors({
          storage: "글을 계정에 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
        });
        return;
      }
      setActiveTab("recommended");
      setDraft(EMPTY_DRAFT);
      closeComposer();
      setAnnouncement("작성한 글을 계정에 저장했습니다.");
      return;
    }

    const result = createLocalCommunityPost({
      category: draft.category,
      title,
      body,
      tags,
    });
    setLocalPosts(result.posts);
    if (!result.post) {
      setDraftErrors({ storage: "글을 브라우저에 저장하지 못했습니다." });
      return;
    }

    setActiveTab("recommended");
    setDraft(EMPTY_DRAFT);
    closeComposer();
    setAnnouncement("작성한 글을 이 브라우저에 저장했습니다.");
  }

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <aside aria-label="내 커리어 바로가기" className={styles.leftRail}>
          <section className={styles.railCard} id="my-stack">
            <div className={styles.railHeadingRow}>
              <div className={styles.railIconTitle}>
                <Stack aria-hidden="true" size={19} weight="bold" />
                <h2>내 기술</h2>
              </div>
              <Link href="/career" prefetch={false}>
                관리
              </Link>
            </div>
            {snapshot.ownedSkills.length > 0 ? (
              <ul aria-label="내 기술" className={styles.ownedSkills}>
                {snapshot.ownedSkills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.stackStatus}>아직 추가한 기술이 없습니다.</p>
            )}
          </section>

          <section className={styles.railCard}>
            <h2>바로가기</h2>
            <nav aria-label="커리어 도구" className={styles.shortcutList}>
              <Link href="/jobs" prefetch={false}>
                <Briefcase aria-hidden="true" size={18} />
                공식 공고 찾기
              </Link>
              <Link href="/career/saved" prefetch={false}>
                <BookmarkSimple aria-hidden="true" size={18} />
                저장 보관함
              </Link>
              <Link href="/career/questions" prefetch={false}>
                <ChatCircle aria-hidden="true" size={18} />
                내 글
              </Link>
              <Link href="/skill-map" prefetch={false}>
                <ChartLineUp aria-hidden="true" size={18} />
                스킬 연결 보기
              </Link>
              <Link href="/data-policy" prefetch={false}>
                <ShieldCheck aria-hidden="true" size={18} />
                데이터 기준
              </Link>
            </nav>
          </section>

          <RecentTopicList />
        </aside>

        <section aria-labelledby="home-feed-title" className={styles.feedColumn}>
          <header className={styles.feedHeader}>
            <h1 id="home-feed-title">
              {hasPersonalization
                ? "내 커리어와 가까운 이야기"
                : "커리어 이야기 둘러보기"}
            </h1>
          </header>

          <HomeCareerContext
            context={snapshot.careerContext}
            ownedSkillCount={snapshot.ownedSkills.length}
          />

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
                <p>커뮤니티 미리보기는 계속 볼 수 있으며, 수치를 임의로 채우지 않습니다.</p>
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

          {community.state.status === "error" && (
            <section className={styles.dataNotice} role="status">
              <WarningCircle aria-hidden="true" size={20} weight="fill" />
              <div>
                <strong>새 커뮤니티 글을 불러오지 못했습니다</strong>
                <p>{community.state.error}</p>
                <button onClick={() => void community.reload()} type="button">
                  커뮤니티 다시 불러오기
                </button>
              </div>
            </section>
          )}

          {community.state.migrationFailedPostIds.length > 0 && (
            <section className={styles.dataNotice} role="status">
              <WarningCircle aria-hidden="true" size={20} weight="fill" />
              <div>
                <strong>브라우저 글 일부를 계정으로 옮기지 못했습니다</strong>
                <p>원본은 그대로 보관했습니다. 연결이 안정되면 다시 시도할 수 있어요.</p>
                <button onClick={() => void community.reload()} type="button">
                  다시 옮기기
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
                {hasPersonalization
                  ? tab.label
                  : tab.unconfiguredLabel ?? tab.label}
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
                const serverItem =
                  item.type === "community_post" && item.source === "server";
                const serverPending =
                  serverItem &&
                  community.state.pendingKeys.some(
                    (key) => key.endsWith(`:${item.id}`) || key.endsWith(`:${item.authorId}`),
                  );
                return (
                  <FeedCard
                    actionDisabled={Boolean(serverPending)}
                    canDelete={Boolean(serverItem && viewer?.id === item.authorId)}
                    followDisabled={
                      serverItem
                        ? Boolean(serverPending || viewer?.id === item.authorId)
                        : !socialHydrated
                    }
                    followed={
                      isSocialItem(item) &&
                      (item.source === "server"
                        ? community.state.viewerState.followedAuthorIds.includes(
                            item.authorId,
                          )
                        : socialInteractions.followedAuthorIds.includes(
                            item.authorId,
                          ))
                    }
                    item={item}
                    key={item.id}
                    localCommentCount={
                      serverItem
                        ? 0
                        : socialInteractions.commentsByPostId[item.id]?.length ?? 0
                    }
                    onDelete={() => {
                      if (item.type === "community_post" && item.source === "local") {
                        deleteLocalPost(item);
                      } else if (
                        item.type === "community_post" &&
                        item.source === "server" &&
                        viewer?.id === item.authorId
                      ) {
                        void deleteServerPost(item);
                      }
                    }}
                    onReact={() => {
                      if (isSocialItem(item)) void handleReaction(item);
                    }}
                    onFollow={() => {
                      if (isSocialItem(item)) void handleAuthorFollow(item);
                    }}
                    onSave={() => {
                      if (recommendedJob) {
                        setSavedJobIds(toggleSavedJob(item.postingId));
                      } else if (isSocialItem(item)) {
                        void handleSocialSave(item);
                      }
                    }}
                    ownedSkills={snapshot.ownedSkills}
                    reacted={
                      serverItem
                        ? community.state.viewerState.reactedPostIds.includes(item.id)
                        : socialInteractions.reactedPostIds.includes(item.id)
                    }
                    saved={
                      recommendedJob
                        ? savedJobIds.includes(item.postingId)
                        : serverItem
                          ? community.state.viewerState.savedPostIds.includes(item.id)
                          : socialInteractions.savedPostIds.includes(item.id)
                    }
                  />
                );
              })
            ) : (
              <div className={styles.emptyFeed}>
                <strong>
                  {activeTab === "following"
                    ? "팔로우한 작성자가 없습니다."
                    : "이 탭에 표시할 글이 없습니다."}
                </strong>
                <p>
                  {activeTab === "following"
                    ? "관심 있는 작성자를 팔로우하면 이 탭에서 모아볼 수 있어요."
                    : "다른 탭을 선택하거나 첫 글을 작성해 보세요."}
                </p>
                {activeTab === "following" && (
                  <button
                    onClick={showRecommendedAuthors}
                    type="button"
                  >
                    추천 탭에서 작성자 찾기
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <aside aria-label="채용 시장 요약" className={styles.rightRail}>
          <section className={styles.railCard}>
            <div className={styles.railHeadingRow}>
              <h2>지금 둘러볼 주제</h2>
            </div>
            <ul className={styles.curatedTopics}>
              {MOCK_SOCIAL_ITEMS.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <Link href={item.href} prefetch={false}>
                    <span>{item.category}</span>
                    <strong>{item.title}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.railCard} id="market-insights">
            <div className={styles.railHeadingRow}>
              <h2>주목할 기술 수요</h2>
              <Link href="/market" prefetch={false}>
                더보기
              </Link>
            </div>
            {snapshot.skillDemand.length > 0 ? (
              <ol className={styles.skillDemand}>
                {snapshot.skillDemand.map((skill) => (
                  <li key={skill.skillName}>
                    <Link
                      href={`/skill-map?skill=${encodeURIComponent(skill.skillName)}`}
                      prefetch={false}
                    >
                      <strong>{skill.skillName}</strong>
                      <span>{skill.postingCount}건</span>
                      <small>
                        필수 {skill.requiredCount} · 우대 {skill.preferredCount} ·
                        미분류 {skill.unspecifiedCount}
                      </small>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.railEmpty}>확인된 기술 수요가 없습니다.</p>
            )}
            <p className={styles.railFootnote}>
              기술 언급 공고를 필수·우대·미분류 중 하나로 집계합니다.
              <Link href="/data-policy" prefetch={false}>
                수집 기준 확인
              </Link>
            </p>
          </section>

          {snapshot.careerInsight.status !== "needs_skills" && (
            <CareerInsightCard insight={snapshot.careerInsight} />
          )}

          <FollowingPostList
            followedAuthorIds={followedAuthorIds}
            hydrated={socialHydrated}
            items={followingRailItems}
            onShowFollowing={showFollowingPosts}
          />
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
                <p>
                  {viewer
                    ? "계정에 저장되는 글"
                    : authReady
                      ? "이 브라우저에만 저장되는 글"
                      : "로그인 상태 확인 중"}
                </p>
                <h2 id="community-composer-title">커뮤니티 글쓰기</h2>
              </div>
              <button aria-label="글쓰기 닫기" onClick={closeComposer} type="button">
                <X aria-hidden="true" size={20} weight="bold" />
              </button>
            </header>

            <form className={styles.composerForm} onSubmit={submitPost}>
              <fieldset className={styles.composerKinds}>
                <legend>글 종류</legend>
                <div>
                  {POST_KIND_OPTIONS.map((option) => (
                    <label
                      data-selected={
                        draft.category === option.value ? "true" : undefined
                      }
                      key={option.value}
                    >
                      <input
                        checked={draft.category === option.value}
                        className={styles.composerKindInput}
                        name="community-post-kind"
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            category: option.value,
                          }))
                        }
                        type="radio"
                        value={option.value}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

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
                {viewer ? (
                  <p>
                    게시한 글은 계정에 안전하게 저장되며 다른 사용자가 볼 수
                    있습니다. 개인정보가 포함되지 않았는지 확인해주세요.
                  </p>
                ) : (
                  <p>
                    로그인 전에는 이 브라우저에 보관됩니다. 이후 로그인하면
                    작성한 글과 반응을 계정으로 안전하게 옮깁니다.
                  </p>
                )}
              </div>

              {draftErrors.storage && (
                <p id="community-post-storage-error" role="alert">
                  {draftErrors.storage}
                </p>
              )}

              <div className={styles.composerActions}>
                <button onClick={closeComposer} type="button">
                  취소
                </button>
                <button
                  disabled={
                    !localPostsHydrated ||
                    Boolean(viewer && community.state.status !== "ready") ||
                    community.state.pendingKeys.includes("create:post")
                  }
                  type="submit"
                >
                  {community.state.pendingKeys.includes("create:post")
                    ? "게시 중..."
                    : "피드에 올리기"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
