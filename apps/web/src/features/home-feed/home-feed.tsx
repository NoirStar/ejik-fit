"use client";

import {
  ArrowRight,
  ArrowSquareOut,
  BookmarkSimple,
  ChartLineUp,
  ChatCircle,
  CheckCircle,
  Heart,
  MapPin,
  ShieldCheck,
  Trash,
  UserCheck,
  UserPlus,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuthViewerContext } from "@/features/auth/auth-viewer-context";
import {
  readCommunityDraft,
  removeCommunityDraft,
  saveCommunityDraft,
} from "@/features/community/community-draft";
import {
  COMMUNITY_FAILURE_COPY,
  type CommunityStore,
} from "@/features/community/community-store";
import type { InitialCommunityFeed } from "@/features/community/community-feed-initial";
import { useCommunityFeed } from "@/features/community/use-community-feed";
import { buildSearchScopeHref } from "@/features/search/model";
import { safeAuthNextPath } from "@/lib/auth/redirect";
import {
  COMMUNITY_CATEGORIES,
  MAX_COMMUNITY_POST_TAGS,
  MAX_COMMUNITY_TAG_LENGTH,
} from "@/lib/community-contract";
import { trapTabKey } from "@/lib/focus-trap";
import { PRODUCT_TERMS } from "@/lib/labels";
import {
  DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY,
  deleteLocalCommunityPost,
  readLocalCommunityPosts,
  subscribeLocalCommunityPosts,
  type LocalCommunityPost,
  type LocalCommunityPostCategory,
} from "@/lib/local-community-posts";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import { removeRecentCommunityTopic } from "@/lib/recent-community-topics";

import { CompanyMark } from "./company-mark";
import { groupFeedForDisplay } from "./feed-display-groups";
import { appendOnlyItemsForTab, itemsForTab } from "./feed-order";
import { FollowingPostList } from "./following-post-list";
import {
  localCommunityPostToFeedItem,
  serverCommunityPostToFeedItem,
} from "./model";
import styles from "./home-feed.module.css";
import { useHomeFeedPagination } from "./use-home-feed-pagination";
import type {
  CareerContextSummary,
  CareerInsightSummary,
  CommunityPostFeedItem,
  FeedItem,
  FeedTab,
  HomeFeedSnapshot,
  MarketInsightFeedItem,
  RecommendedJobFeedItem,
  SkillDemandSummary,
} from "./types";

export type HomeFeedProps = {
  snapshot: HomeFeedSnapshot;
  composeMode?: "new" | "resume" | null;
  initialCommunityFeed?: InitialCommunityFeed;
  communityStore?: CommunityStore;
};

type LocalPostDraft = {
  category: LocalCommunityPostCategory;
  title: string;
  body: string;
  tags: string;
};
type DraftErrors = Partial<
  Record<"title" | "body" | "storage" | "tags", string>
>;
type SocialItem = CommunityPostFeedItem;

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

const POST_KIND_OPTIONS = COMMUNITY_CATEGORIES.map((value) => ({
  label: value,
  value,
}));

const EMPTY_DRAFT: LocalPostDraft = {
  category: DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY,
  title: "",
  body: "",
  tags: "",
};

const HOME_COPY = {
  title: "추천 피드",
  market: "채용 시장",
  addSkills:
    "기술을 등록하면 맞는 공고와 다음에 배울 기술을 확인할 수 있습니다.",
  followingEmpty: "팔로우한 작성자의 글이 없습니다.",
  followingAction: "다른 글에서 관심 있는 작성자를 팔로우해 주세요.",
} as const;

function draftTags(value: string) {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.split(",")) {
    const tag = candidate.trim();
    const key = tag.toLocaleLowerCase("ko-KR");
    if (!tag || seen.has(key)) continue;
    if (tag.length > MAX_COMMUNITY_TAG_LENGTH) return null;
    tags.push(tag);
    seen.add(key);
    if (tags.length > MAX_COMMUNITY_POST_TAGS) return null;
  }
  return tags;
}

function isSocialItem(item: FeedItem): item is SocialItem {
  return item.type === "community_post";
}

function mergeLiveFeedItems(primary: FeedItem[], live: CommunityPostFeedItem[]) {
  const merged: FeedItem[] = [...live];
  const seen = new Set(live.map(({ id }) => id));
  for (const item of primary) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
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
        <p>{item.body}</p>
      </div>

      <ul aria-label={`${item.title} 태그`} className={styles.tags}>
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
  compact,
  item,
  onSave,
  ownedSkills,
  saved,
}: {
  compact: boolean;
  item: RecommendedJobFeedItem;
  onSave(): void;
  ownedSkills: string[];
  saved: boolean;
}) {
  const titleId = `feed-${item.id}-title`;
  const hasOwnedSkills = ownedSkills.length > 0;
  const matchedRequired = new Set(item.matchedRequiredSkills);
  const matchedPreferred = new Set(item.matchedPreferredSkills);
  const required = item.requiredSkills.map((skill) => ({
    kind: hasOwnedSkills
      ? matchedRequired.has(skill)
        ? "matched"
        : "missing"
      : "neutral",
    skill,
  }));
  const requiredNames = new Set(item.requiredSkills);
  const preferred = item.preferredSkills
    .filter((skill) => !requiredNames.has(skill))
    .map((skill) => ({
      kind: matchedPreferred.has(skill) ? "matched" : "preferred",
      skill,
    }));
  const skills = [...required, ...preferred];
  const visibleSkills = skills.slice(0, compact ? 3 : 4);
  const hiddenSkillCount = Math.max(0, skills.length - visibleSkills.length);

  return (
    <article
      aria-labelledby={titleId}
      className={styles.jobCard}
      data-compact={compact ? "true" : undefined}
    >
      <div className={styles.jobShell}>
        <Link
          aria-label={`${item.title} 공고 보기`}
          className={styles.jobMainLink}
          href={item.href}
          prefetch={false}
        >
          <div className={styles.jobIdentity}>
            <CompanyMark
              companyName={item.companyName}
              companySlug={item.companySlug}
              priority={!compact}
              size={compact ? 40 : 44}
              sourceUrl={item.sourceUrl}
            />
            <div>
              <p>{item.companyName}</p>
              <h2 id={titleId}>{item.title}</h2>
              <div className={styles.jobMeta}>
                <span>
                  <MapPin aria-hidden="true" size={14} />
                  {item.location}
                </span>
                <span>{item.careerLabel}</span>
                <span>{item.employmentLabel}</span>
                <span>{item.verifiedLabel} 확인</span>
              </div>
            </div>
          </div>

          {(visibleSkills.length > 0 ||
            (hasOwnedSkills && item.requiredSkills.length > 0)) && (
            <div className={styles.jobSignalRow}>
              {hasOwnedSkills && item.requiredSkills.length > 0 && (
                <strong className={styles.matchSummary}>
                  필수 {item.matchedRequiredSkills.length}/
                  {item.requiredSkills.length} 일치
                </strong>
              )}
              {visibleSkills.length > 0 && (
                <div
                  aria-label={`${item.title} 기술 요건`}
                  className={styles.jobSkills}
                >
                  {visibleSkills.map(({ kind, skill }) => (
                    <span data-kind={kind} key={`${kind}-${skill}`}>
                      {skill}
                    </span>
                  ))}
                  {hiddenSkillCount > 0 && <small>외 {hiddenSkillCount}개</small>}
                </div>
              )}
            </div>
          )}
        </Link>

        <div className={styles.jobTools}>
          <a
            aria-label={`${item.title} 공식 원문`}
            className={styles.jobTool}
            href={item.sourceUrl}
            rel="noreferrer"
            target="_blank"
            title="공식 원문"
          >
            <ArrowSquareOut aria-hidden="true" size={18} />
          </a>
          <button
            aria-label={`${item.title} ${saved ? "저장 해제" : "저장"}`}
            aria-pressed={saved}
            className={styles.jobTool}
            data-active={saved ? "true" : undefined}
            onClick={onSave}
            title={saved ? "저장 해제" : "저장"}
            type="button"
          >
            <BookmarkSimple
              aria-hidden="true"
              size={19}
              weight={saved ? "fill" : "regular"}
            />
          </button>
        </div>
      </div>
    </article>
  );
}

function JobCluster({
  items,
  onSave,
  ownedSkills,
  savedJobIds,
}: {
  items: RecommendedJobFeedItem[];
  onSave(postingId: string): void;
  ownedSkills: string[];
  savedJobIds: string[];
}) {
  const compact = items.length > 1;

  return (
    <section
      aria-label={`추천 공고 ${items.length}개`}
      className={styles.jobCluster}
    >
      <header className={styles.jobClusterHeader}>
        <span>
          <ShieldCheck aria-hidden="true" size={16} weight="fill" />
          추천 공고
        </span>
        <small>공식 채용 페이지 · {items.length}개</small>
      </header>
      <div className={styles.jobClusterList}>
        {items.map((item) => (
          <JobCard
            compact={compact}
            item={item}
            key={item.id}
            onSave={() => onSave(item.postingId)}
            ownedSkills={ownedSkills}
            saved={savedJobIds.includes(item.postingId)}
          />
        ))}
      </div>
    </section>
  );
}

function MarketCard({ item }: { item: MarketInsightFeedItem }) {
  const titleId = `feed-${item.id}-title`;
  const totalCount = Math.max(
    1,
    item.requiredCount + item.preferredCount + item.unspecifiedCount,
  );

  return (
    <article aria-labelledby={titleId} className={styles.marketCard}>
      <div className={styles.marketIcon}>
        <ChartLineUp aria-hidden="true" size={21} weight="bold" />
      </div>
      <div className={styles.marketBody}>
        <div className={styles.marketTopline}>
          <span>{HOME_COPY.market}</span>
          <small>{item.sourceLabel}</small>
        </div>
        <h2 id={titleId}>
          <Link href={item.href} prefetch={false}>
            {item.title}
          </Link>
        </h2>
        <p>{item.summary}</p>
        <div
          aria-label={`${item.skillName} 채용 수요 구성`}
          className={styles.demandDistribution}
          role="img"
        >
          <span
            data-kind="required"
            style={{ width: `${(item.requiredCount / totalCount) * 100}%` }}
          />
          <span
            data-kind="preferred"
            style={{ width: `${(item.preferredCount / totalCount) * 100}%` }}
          />
          <span
            data-kind="unspecified"
            style={{ width: `${(item.unspecifiedCount / totalCount) * 100}%` }}
          />
        </div>
        <div className={styles.marketLegend}>
          <strong>{item.sampleLabel}</strong>
          <span data-kind="required">필수 {item.requiredCount}건</span>
          <span data-kind="preferred">우대 {item.preferredCount}건</span>
          <span data-kind="unspecified">구분 없음 {item.unspecifiedCount}건</span>
        </div>
        <Link className={styles.marketLink} href={item.href} prefetch={false}>
          스킬맵에서 공고 근거 보기
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </article>
  );
}

function CareerBriefing({
  context,
  insight,
  ownedSkillCount,
  topDemand,
}: {
  context: CareerContextSummary;
  insight: CareerInsightSummary;
  ownedSkillCount: number;
  topDemand: SkillDemandSummary | null;
}) {
  const titleId = "home-career-briefing-title";
  const readyInsight =
    ownedSkillCount > 0 && insight.status === "ready" ? insight : null;
  const unavailableInsight =
    ownedSkillCount > 0 && insight.status === "unavailable";

  return (
    <section aria-labelledby={titleId} className={styles.careerBriefing}>
      <header className={styles.briefingHeader}>
        <div>
          <h1 id={titleId}>내 커리어 브리핑</h1>
          <p>
            {context.careerConditionLabel} · {context.targetDomainLabel}
          </p>
        </div>
        <Link
          aria-label="내 커리어 기준 수정"
          className={styles.briefingSettings}
          href="/career"
          prefetch={false}
        >
          기준 수정
          <ArrowRight aria-hidden="true" size={14} weight="bold" />
        </Link>
      </header>

      <div className={styles.briefingGrid}>
        {readyInsight ? (
          <>
            <Link className={styles.briefingMetric} href="/career" prefetch={false}>
              <span>맞는 공고</span>
              <strong>{readyInsight.matchingPostingCount.toLocaleString("ko-KR")}건</strong>
              <small>
                필수 기술 절반 이상 {readyInsight.strongFitPostingCount.toLocaleString("ko-KR")}건
              </small>
            </Link>
            {readyInsight.nextSkill ? (
              <Link
                aria-label={`${readyInsight.nextSkill.skillName} 근거 보기`}
                className={styles.briefingMetric}
                href={`/skill-map?skill=${encodeURIComponent(readyInsight.nextSkill.skillName)}`}
                prefetch={false}
              >
                <span>{PRODUCT_TERMS.nextSkill}</span>
                <strong>{readyInsight.nextSkill.skillName}</strong>
                <small>
                  관련 공고 {readyInsight.nextSkill.supportingPostingCount.toLocaleString("ko-KR")}건에서 부족
                </small>
              </Link>
            ) : (
              <div className={styles.briefingMetric}>
                <span>{PRODUCT_TERMS.nextSkill}</span>
                <strong>추가 추천 없음</strong>
                <small>현재 맞는 공고에서 반복된 부족 기술이 없습니다.</small>
              </div>
            )}
          </>
        ) : unavailableInsight ? (
          <div className={styles.briefingState} role="status">
            <strong>맞는 공고를 불러오지 못했습니다.</strong>
            <small>잠시 후 다시 확인해 주세요.</small>
          </div>
        ) : (
          <Link
            aria-label="내 기술 등록"
            className={styles.briefingSetup}
            href="/career"
            prefetch={false}
          >
            <span>
              <strong>맞춤 추천 시작하기</strong>
              <small>{HOME_COPY.addSkills}</small>
            </span>
            <em>
              내 기술 등록
              <ArrowRight aria-hidden="true" size={15} weight="bold" />
            </em>
          </Link>
        )}

        {topDemand ? (
          <Link
            aria-label={`${topDemand.skillName} 수요 근거 보기`}
            className={styles.briefingMetric}
            href={`/skill-map?skill=${encodeURIComponent(topDemand.skillName)}`}
            prefetch={false}
          >
            <span>현재 수요 상위</span>
            <strong>{topDemand.skillName}</strong>
            <small>기술 언급 공고 {topDemand.postingCount.toLocaleString("ko-KR")}건</small>
          </Link>
        ) : (
          <div className={styles.briefingMetric}>
            <span>현재 수요 상위</span>
            <strong>확인 중</strong>
            <small>수집된 공고를 분석하고 있습니다.</small>
          </div>
        )}
      </div>
    </section>
  );
}

function LegacyPostRecovery({
  onDelete,
  posts,
}: {
  onDelete(post: CommunityPostFeedItem): void;
  posts: CommunityPostFeedItem[];
}) {
  if (posts.length === 0) return null;

  return (
    <section aria-label="이 기기에 남은 글" className={styles.legacyRecovery}>
      <header>
        <div>
          <h2>이 기기에 남은 글</h2>
          <p>
            계정에 게시되지 않은 글입니다. 내용을 확인하거나 삭제해 주세요.
          </p>
        </div>
        <span>{posts.length.toLocaleString("ko-KR")}개</span>
      </header>
      <div className={styles.legacyRecoveryList}>
        {posts.map((post) => (
          <article aria-labelledby={`legacy-${post.id}-title`} key={post.id}>
            <div>
              <span>{post.category}</span>
              <h3 id={`legacy-${post.id}-title`}>{post.title}</h3>
              <small>{post.createdLabel} · 이 기기에만 있음</small>
            </div>
            <div className={styles.legacyRecoveryActions}>
              <Link
                aria-label={`${post.title} 내용 확인`}
                href={post.href}
                prefetch={false}
              >
                내용 확인
              </Link>
              <button
                aria-label={`${post.title} 삭제`}
                onClick={() => onDelete(post)}
                type="button"
              >
                <Trash aria-hidden="true" size={15} />
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>
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
      <JobCard
        compact={false}
        item={item}
        onSave={onSave}
        ownedSkills={ownedSkills}
        saved={saved}
      />
    );
  }

  return <MarketCard item={item} />;
}

export function HomeFeed({
  composeMode = null,
  communityStore,
  initialCommunityFeed,
  snapshot,
}: HomeFeedProps) {
  const router = useRouter();
  const {
    error: authError,
    ready: authReady,
    status: authStatus,
    viewer,
  } = useAuthViewerContext();
  const [activeTab, setActiveTab] = useState<FeedTab>("recommended");
  const publicCommunityDirtyRef = useRef(false);
  const publicCommunity = useCommunityFeed({
    authReady,
    initialFeed: initialCommunityFeed,
    limit: 10,
    store: communityStore,
    viewer,
  });
  const followingCommunity = useCommunityFeed({
    authReady,
    enabled: activeTab === "following",
    followingOnly: true,
    limit: 10,
    store: communityStore,
    viewer,
  });
  const community = activeTab === "following"
    ? followingCommunity
    : publicCommunity;
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [localPosts, setLocalPosts] = useState<LocalCommunityPost[]>([]);
  const [localPostsHydrated, setLocalPostsHydrated] = useState(false);
  const [composerOpen, setComposerOpen] = useState(composeMode !== null);
  const [draft, setDraft] = useState<LocalPostDraft>(EMPTY_DRAFT);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [announcement, setAnnouncement] = useState("");
  const composerTitleRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const feedSentinelRef = useRef<HTMLDivElement>(null);
  const tabOrderRef = useRef<Partial<Record<FeedTab, string[]>>>({});
  const hasPersonalization =
    snapshot.careerContext.configured || snapshot.ownedSkills.length > 0;

  useEffect(() => {
    setSavedJobIds(readSavedJobIds());
    return subscribeSavedJobs(setSavedJobIds);
  }, []);

  useEffect(() => {
    setLocalPosts(readLocalCommunityPosts());
    setLocalPostsHydrated(true);
    return subscribeLocalCommunityPosts(setLocalPosts);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setDraft(EMPTY_DRAFT);
    setDraftRestored(false);
    setDraftErrors({});
    if (typeof window !== "undefined") {
      removeCommunityDraft(window.sessionStorage);
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
    if (!composeMode) return;
    setComposerOpen(true);
    if (composeMode !== "resume" || typeof window === "undefined") return;

    const restored = readCommunityDraft(window.sessionStorage);
    if (!restored) return;
    setDraft({
      category: restored.category,
      title: restored.title,
      body: restored.body,
      tags: restored.tags.join(", "),
    });
    setDraftRestored(true);
  }, [composeMode]);

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
  const publicServerFeedItems = useMemo(
    () =>
      publicCommunity.state.posts.map((post) =>
        serverCommunityPostToFeedItem(post),
      ),
    [publicCommunity.state.posts],
  );
  const followingServerFeedItems = useMemo(
    () =>
      followingCommunity.state.posts.map((post) =>
        serverCommunityPostToFeedItem(post),
      ),
    [followingCommunity.state.posts],
  );
  const serverFeedItems = activeTab === "following"
    ? followingServerFeedItems
    : publicServerFeedItems;
  const loadMorePublicCommunity = publicCommunity.loadMore;
  const loadNextPublicCommunityPage = useCallback(async () => {
    const page = await loadMorePublicCommunity();
    if (!page) throw new Error(COMMUNITY_FAILURE_COPY.load);
    return {
      items: page.items.map((post) => serverCommunityPostToFeedItem(post)),
      hasMore: page.nextCursor !== null,
    };
  }, [loadMorePublicCommunity]);
  const loadMoreFollowingCommunity = followingCommunity.loadMore;
  const loadNextFollowingCommunityPage = useCallback(async () => {
    const page = await loadMoreFollowingCommunity();
    if (!page) throw new Error(COMMUNITY_FAILURE_COPY.load);
    return {
      items: page.items.map((post) => serverCommunityPostToFeedItem(post)),
      hasMore: page.nextCursor !== null,
    };
  }, [loadMoreFollowingCommunity]);
  const publicPagination = useHomeFeedPagination({
    activeTab: activeTab === "following" ? "recommended" : activeTab,
    careerType: snapshot.careerContext.careerCondition,
    communityStatus: publicCommunity.state.status,
    enabled: activeTab !== "following",
    initialCommunity: publicServerFeedItems,
    initialCommunityHasMore:
      activeTab !== "following" &&
      publicCommunity.state.nextCursor !== null,
    initialInsights: snapshot.marketInsights,
    initialJobs: snapshot.recommendedJobs,
    jobTotal: snapshot.postingCount,
    liveCommunity: publicServerFeedItems,
    loadCommunity:
      activeTab !== "following" ? loadNextPublicCommunityPage : undefined,
    ownedSkills: snapshot.ownedSkills,
  });
  const followingPagination = useHomeFeedPagination({
    activeTab: "following",
    communityStatus: followingCommunity.state.status,
    enabled: activeTab === "following",
    initialCommunity: [],
    initialCommunityHasMore:
      activeTab === "following" &&
      followingCommunity.state.nextCursor !== null,
    initialInsights: [],
    initialJobs: [],
    jobTotal: 0,
    liveCommunity: followingServerFeedItems,
    loadCommunity:
      activeTab === "following"
        ? loadNextFollowingCommunityPage
        : undefined,
    ownedSkills: snapshot.ownedSkills,
  });
  const pagination = activeTab === "following"
    ? followingPagination
    : publicPagination;

  useEffect(() => {
    if (activeTab === "following" || !publicCommunityDirtyRef.current) return;
    publicCommunityDirtyRef.current = false;
    void publicCommunity.reload();
  }, [activeTab, publicCommunity.reload]);
  const followingRailItems = useMemo(
    () => serverFeedItems,
    [serverFeedItems],
  );
  const followedAuthorIds = community.state.viewerState.followedAuthorIds;
  const paginationItems = useMemo(() => {
    const hasServerRenderedCommunity = initialCommunityFeed?.status === "ready";
    return activeTab === "recommended" && hasServerRenderedCommunity
      ? pagination.items
      : mergeLiveFeedItems(pagination.items, serverFeedItems);
  }, [activeTab, initialCommunityFeed?.status, pagination.items, serverFeedItems]);
  const visibleItems = useMemo(() => {
    if (activeTab === "recommended") {
      return itemsForTab(paginationItems, activeTab, followedAuthorIds);
    }
    const result = appendOnlyItemsForTab(
      paginationItems,
      activeTab,
      tabOrderRef.current[activeTab] ?? [],
      followedAuthorIds,
    );
    tabOrderRef.current[activeTab] = result.orderIds;
    return result.items;
  }, [activeTab, followedAuthorIds, paginationItems]);
  const displayGroups = useMemo(
    () => groupFeedForDisplay(visibleItems),
    [visibleItems],
  );
  const maximumDemandCount = Math.max(
    1,
    ...snapshot.skillDemand.map((skill) => skill.postingCount),
  );

  useEffect(() => {
    const target = feedSentinelRef.current;
    if (
      !target ||
      typeof IntersectionObserver === "undefined" ||
      pagination.complete ||
      pagination.error ||
      pagination.loading ||
      community.state.status === "idle" ||
      community.state.status === "loading" ||
      (activeTab === "following" && community.state.status !== "ready")
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void pagination.loadNext(activeTab);
        }
      },
      { root: null, rootMargin: "800px 0px", threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [
    activeTab,
    community.state.status,
    pagination.complete,
    pagination.error,
    pagination.items.length,
    pagination.loadNext,
    pagination.loading,
  ]);

  function requestLoginForCommunity(nextPath = "/") {
    if (authStatus !== "unauthenticated") {
      setAnnouncement(
        authStatus === "loading"
          ? "로그인 상태를 확인하는 중…"
          : authError || COMMUNITY_FAILURE_COPY.authCheck,
      );
      return;
    }
    setAnnouncement("로그인하면 공감·저장·팔로우를 계정에 보관할 수 있습니다.");
    const safeNextPath = safeAuthNextPath(nextPath);
    router.push(`/login?next=${encodeURIComponent(safeNextPath)}`);
  }

  async function handleAuthorFollow(item: SocialItem) {
    if (item.source !== "server") return;
    if (!viewer) {
      requestLoginForCommunity();
      return;
    }
    setAnnouncement("");
    const changed = await community.toggleFollowed(item.authorId);
    if (changed && activeTab === "following") {
      publicCommunityDirtyRef.current = true;
    }
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
          ? "글과 반응·댓글을 함께 삭제하지 못했습니다. 글은 그대로 두었습니다."
          : "글을 삭제하지 못했습니다. 글은 그대로 두었습니다.",
      );
      return;
    }
    removeRecentCommunityTopic(post.id);
    setAnnouncement("글을 삭제했습니다.");
  }

  async function deleteServerPost(post: CommunityPostFeedItem) {
    const deleted = await community.deletePost(post.id);
    if (deleted) {
      if (activeTab === "following") publicCommunityDirtyRef.current = true;
      publicPagination.remove(post.id);
      followingPagination.remove(post.id);
    }
    setAnnouncement(
      deleted
        ? "글을 삭제했습니다."
        : "글을 삭제하지 못했습니다. 글은 그대로 두었습니다.",
    );
  }

  async function handleReaction(item: SocialItem) {
    if (item.source !== "server") return;
    if (!viewer) {
      requestLoginForCommunity();
      return;
    }
    setAnnouncement("");
    const changed = await community.toggleReaction(item.id);
    if (changed && activeTab === "following") {
      publicCommunityDirtyRef.current = true;
    }
  }

  async function handleSocialSave(item: SocialItem) {
    if (item.source !== "server") return;
    if (!viewer) {
      requestLoginForCommunity();
      return;
    }
    setAnnouncement("");
    const changed = await community.toggleSaved(item.id);
    if (changed && activeTab === "following") {
      publicCommunityDirtyRef.current = true;
    }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();
    const tags = draftTags(draft.tags);
    const nextErrors: DraftErrors = {};
    if (!title) nextErrors.title = "제목을 입력해 주세요.";
    if (!body) nextErrors.body = "내용을 입력해 주세요.";
    if (!tags) {
      nextErrors.tags = `태그는 중복을 제외하고 최대 ${MAX_COMMUNITY_POST_TAGS}개, 각 ${MAX_COMMUNITY_TAG_LENGTH}자까지 입력해 주세요.`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setDraftErrors(nextErrors);
      return;
    }
    if (!tags) return;

    if (authStatus === "loading" || authStatus === "error") {
      setDraftErrors({
        storage:
          authStatus === "loading"
            ? "로그인 상태를 확인하는 중…"
            : authError || COMMUNITY_FAILURE_COPY.authCheck,
      });
      return;
    }

    if (viewer) {
      const result = await publicCommunity.createPost({
        category: draft.category,
        title,
        body,
        tags,
      });
      if (!result.post) {
        setDraftErrors({
          storage: result.error || COMMUNITY_FAILURE_COPY.create,
        });
        return;
      }
      publicPagination.prepend(serverCommunityPostToFeedItem(result.post));
      setActiveTab("recommended");
      setDraft(EMPTY_DRAFT);
      if (typeof window !== "undefined") {
        removeCommunityDraft(window.sessionStorage);
      }
      setDraftRestored(false);
      closeComposer();
      setAnnouncement("글을 게시했습니다.");
      return;
    }

    try {
      saveCommunityDraft(
        { category: draft.category, title, body, tags },
        window.sessionStorage,
      );
    } catch {
      setDraftErrors({ storage: COMMUNITY_FAILURE_COPY.create });
      return;
    }
    setAnnouncement("작성 내용을 임시 저장했습니다. 로그인 후 게시 내용을 확인해 주세요.");
    requestLoginForCommunity("/?compose=resume");
  }

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <CareerBriefing
          context={snapshot.careerContext}
          insight={snapshot.careerInsight}
          ownedSkillCount={snapshot.ownedSkills.length}
          topDemand={snapshot.skillDemand[0] ?? null}
        />

        <section aria-labelledby="home-feed-title" className={styles.feedColumn}>
          <header className={styles.feedHeader}>
            <h2 id="home-feed-title">{HOME_COPY.title}</h2>
          </header>

          {snapshot.dataStatus !== "ready" && (
            <section className={styles.dataNotice} role="status">
              <WarningCircle aria-hidden="true" size={20} weight="fill" />
              <div>
                <strong>
                  {snapshot.dataStatus === "partial"
                    ? "일부 정보를 불러오지 못했습니다."
                    : snapshot.dataStatus === "empty"
                      ? "표시할 정보가 없습니다."
                      : "정보를 불러오지 못했습니다."}
                </strong>
                <p>불러온 정보만 표시합니다.</p>
                {snapshot.resourceErrors.length > 0 && (
                  <ul aria-label="데이터 오류">
                    {snapshot.resourceErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
                <button onClick={() => window.location.reload()} type="button">
                  다시 불러오기
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

          <div aria-label="피드 보기" className={styles.tabs} role="tablist">
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
            {`${visibleItems.length}개의 콘텐츠를 표시합니다.`}
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
              displayGroups.map((group) => {
                if (group.kind === "jobs") {
                  return (
                    <JobCluster
                      items={group.items}
                      key={`jobs-${group.items[0]?.id ?? "empty"}`}
                      onSave={(postingId) => {
                        setSavedJobIds(toggleSavedJob(postingId));
                      }}
                      ownedSkills={snapshot.ownedSkills}
                      savedJobIds={savedJobIds}
                    />
                  );
                }

                const item = group.item;
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
                        : true
                    }
                    followed={
                      isSocialItem(item) &&
                      item.source === "server" &&
                      community.state.viewerState.followedAuthorIds.includes(
                        item.authorId,
                      )
                    }
                    item={item}
                    key={item.id}
                    localCommentCount={0}
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
                      if (isSocialItem(item)) {
                        void handleSocialSave(item);
                      }
                    }}
                    ownedSkills={snapshot.ownedSkills}
                    reacted={
                      serverItem
                        ? community.state.viewerState.reactedPostIds.includes(item.id)
                        : false
                    }
                    saved={
                      serverItem
                          ? community.state.viewerState.savedPostIds.includes(item.id)
                          : false
                    }
                  />
                );
              })
            ) : (
              <div className={styles.emptyFeed}>
                <strong>
                  {activeTab === "following"
                    ? HOME_COPY.followingEmpty
                    : "이 탭에 표시할 글이 없습니다."}
                </strong>
                <p>
                  {activeTab === "following"
                    ? HOME_COPY.followingAction
                    : "다른 탭을 선택하거나 첫 글을 작성해 주세요."}
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

          <div
            aria-busy={pagination.loading}
            className={styles.feedPagination}
            data-testid="home-feed-sentinel"
            ref={feedSentinelRef}
          >
            {pagination.loading && <p role="status">새 글을 불러오는 중…</p>}
            {pagination.error && (
              <div className={styles.feedPaginationError}>
                <p role="alert">{pagination.error}</p>
                <button
                  onClick={() => void pagination.retry(activeTab)}
                  type="button"
                >
                  다시 시도
                </button>
              </div>
            )}
            {community.state.actionError && (
              <p role="alert">{community.state.actionError}</p>
            )}
            {pagination.complete &&
              visibleItems.length > 0 &&
              !pagination.error && (
                <p className={styles.feedComplete} role="status">
                  모든 콘텐츠를 확인했습니다.
                </p>
              )}
          </div>

          {localPostsHydrated && (
            <LegacyPostRecovery
              onDelete={deleteLocalPost}
              posts={localFeedItems}
            />
          )}
        </section>

        <aside aria-label="채용 시장 요약" className={styles.rightRail}>
          <section className={styles.railCard} id="market-insights">
            <div className={styles.railHeadingRow}>
              <h2>현재 기술 수요</h2>
              <Link href="/market" prefetch={false}>
                더보기
              </Link>
            </div>
            <p className={styles.railScope}>
              분석 공고 {snapshot.postingCount.toLocaleString("ko-KR")}개 · 최근 수집 기준
            </p>
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
                      <i aria-hidden="true" className={styles.skillDemandTrack}>
                        <b
                          style={{
                            width: `${Math.max(
                              6,
                              (skill.postingCount / maximumDemandCount) * 100,
                            )}%`,
                          }}
                        />
                      </i>
                      <small>
                        필수 {skill.requiredCount} · 우대 {skill.preferredCount} ·
                        구분 없음 {skill.unspecifiedCount}
                      </small>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.railEmpty}>확인된 기술 수요가 없습니다.</p>
            )}
            <p className={styles.railFootnote}>
              ‘구분 없음’은 공고에 기술이 나오지만 필수·우대로
              구분되지 않은 경우입니다.
              <Link href="/data-policy" prefetch={false}>
                수집 기준 확인
              </Link>
            </p>
          </section>

          <FollowingPostList
            followedAuthorIds={followedAuthorIds}
            hydrated={community.state.status === "ready"}
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
                <h2 id="community-composer-title">커뮤니티 글쓰기</h2>
              </div>
              <button aria-label="글쓰기 닫기" onClick={closeComposer} type="button">
                <X aria-hidden="true" size={20} weight="bold" />
              </button>
            </header>

            <form className={styles.composerForm} onSubmit={submitPost}>
              {draftRestored && (
                <p role="status">임시 저장된 글을 불러왔습니다.</p>
              )}
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
                placeholder="상황과 궁금한 점을 구체적으로 적어 주세요."
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
                aria-describedby={
                  draftErrors.tags ? "community-post-tags-error" : undefined
                }
                aria-invalid={Boolean(draftErrors.tags)}
                id="community-post-tags"
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    tags: event.target.value,
                  }));
                  if (draftErrors.tags) {
                    setDraftErrors((current) => {
                      const next = { ...current };
                      delete next.tags;
                      return next;
                    });
                  }
                }}
                placeholder="쉼표로 구분, 최대 4개"
                value={draft.tags}
              />
              {draftErrors.tags && (
                <p id="community-post-tags-error" role="alert">
                  {draftErrors.tags}
                </p>
              )}

              <div className={styles.composerNote}>
                <ShieldCheck aria-hidden="true" size={18} />
                {viewer ? (
                  <p>개인정보와 회사 기밀은 적지 말아 주세요.</p>
                ) : (
                  <p>
                    게시하려면 로그인이 필요합니다. 작성 내용은 로그인하는 동안
                    이 탭에 남아 있습니다.
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
                    !authReady ||
                    !localPostsHydrated ||
                    Boolean(
                      viewer && publicCommunity.state.status !== "ready",
                    ) ||
                    publicCommunity.state.pendingKeys.includes("create:post")
                  }
                  type="submit"
                >
                  {publicCommunity.state.pendingKeys.includes("create:post")
                    ? "게시 중…"
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
