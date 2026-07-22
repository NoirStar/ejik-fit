"use client";

import {
  ArrowRight,
  ArrowSquareOut,
  BookmarkSimple,
  Briefcase,
  CheckCircle,
  ShieldCheck,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useAuthViewerContext } from "@/features/auth/auth-viewer-context";
import type { CommunityStore } from "@/features/community/community-store";
import { useCommunityFeed } from "@/features/community/use-community-feed";
import { CompanyMark } from "@/features/home-feed/company-mark";
import {
  localCommunityPostToFeedItem,
  serverCommunityPostToFeedItem,
} from "@/features/home-feed/model";
import {
  APPLICATION_STAGES,
  applicationStageLabel,
  readJobApplicationStages,
  removeJobApplicationStage,
  setJobApplicationStage,
  subscribeJobApplicationStages,
  type JobApplicationStageValue,
  type JobApplicationStages,
} from "@/lib/job-application-stages";
import {
  readLocalCommunityPosts,
  subscribeLocalCommunityPosts,
  type LocalCommunityPost,
} from "@/lib/local-community-posts";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import {
  EMPTY_SOCIAL_INTERACTIONS,
  readSocialInteractions,
  subscribeSocialInteractions,
  togglePostSave,
  type SocialInteractions,
} from "@/lib/social-interactions";

import {
  normalizeSavedJobDataResponse,
  selectSavedCommunityItems,
  type SavedCommunityItem,
  type SavedJobData,
  type SavedJobItem,
} from "./model";
import styles from "./saved-library.module.css";

export type SavedScope = "all" | "jobs" | "applications" | "community";

type JobRequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: SavedJobData }
  | { status: "error" };

const SCOPES = [
  { value: "all", label: "전체" },
  { value: "jobs", label: "공식 공고" },
  { value: "applications", label: "지원 관리" },
  { value: "community", label: "커뮤니티" },
] as const satisfies ReadonlyArray<{ value: SavedScope; label: string }>;

function SavedJobCard({
  item,
  applicationStage,
  onApplicationStageChange,
  onRemove,
}: {
  item: SavedJobItem;
  applicationStage: JobApplicationStageValue;
  onApplicationStageChange: (stage: JobApplicationStageValue) => void;
  onRemove: () => void;
}) {
  const removalNoteId = useId();
  const skills = [
    ...item.requiredSkills.map((name) => ({ name, label: "필수", kind: "required" })),
    ...item.preferredSkills.map((name) => ({ name, label: "우대", kind: "preferred" })),
    ...item.unspecifiedSkills.map((name) => ({ name, label: "언급", kind: "unspecified" })),
  ];

  return (
    <article aria-label={item.title} className={styles.jobCard}>
      <div className={styles.jobIdentity}>
        <CompanyMark
          companyName={item.companyName}
          size={48}
          sourceUrl={item.sourceUrl}
        />
        <div>
          <div className={styles.jobTopline}>
            <span className={styles.actualBadge}>
              <ShieldCheck aria-hidden="true" size={13} weight="fill" />
              현재 API 재확인
            </span>
            <span data-open={item.status === "open" ? "true" : undefined}>
              {item.statusLabel}
            </span>
          </div>
          <h3>
            <Link href={item.detailHref}>{item.title}</Link>
          </h3>
          <p>
            {item.companyHref ? (
              <Link href={item.companyHref}>{item.companyName}</Link>
            ) : (
              item.companyName
            )}
          </p>
        </div>
      </div>

      <div className={styles.jobFacts}>
        <span>{item.careerLabel}</span>
        <span>{item.employmentLabel}</span>
        <span>{item.location}</span>
        <span>{item.closingLabel ?? item.verifiedLabel}</span>
      </div>

      {skills.length > 0 ? (
        <ul aria-label={`${item.title} 확인 기술`} className={styles.skillList}>
          {skills.map((skill) => (
            <li data-kind={skill.kind} key={`${skill.kind}-${skill.name}`}>
              <Link href={`/skill-map?skill=${encodeURIComponent(skill.name)}`}>
                {skill.label} {skill.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.noSkills}>현재 응답에서 확인된 기술이 없습니다.</p>
      )}

      <div
        className={styles.applicationControl}
        data-active={applicationStage ? "true" : undefined}
      >
        <label>
          <span>지원 단계</span>
          <select
            aria-label={`${item.title} 지원 단계`}
            onChange={(event) =>
              onApplicationStageChange(
                event.target.value as JobApplicationStageValue,
              )
            }
            value={applicationStage}
          >
            {APPLICATION_STAGES.map((stage) => (
              <option key={stage.value || "unset"} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </select>
        </label>
        <small id={removalNoteId}>
          브라우저 저장 · 로그인 시 동기화
          {applicationStage ? " · 저장 해제 시 단계도 삭제" : ""}
        </small>
      </div>

      <footer className={styles.jobActions}>
        <Link href={item.detailHref}>
          공고 분석
          <ArrowRight aria-hidden="true" size={15} weight="bold" />
        </Link>
        <a href={item.sourceUrl} rel="noreferrer" target="_blank">
          공식 원문
          <ArrowSquareOut aria-hidden="true" size={14} weight="bold" />
        </a>
        <button
          aria-describedby={applicationStage ? removalNoteId : undefined}
          aria-label={`${item.title} 저장 해제`}
          onClick={onRemove}
          type="button"
        >
          <Trash aria-hidden="true" size={16} />
          저장 해제
        </button>
      </footer>
    </article>
  );
}

export function SavedLibrary({
  communityStore,
  initialScope = "all",
}: {
  communityStore?: CommunityStore;
  initialScope?: SavedScope;
}) {
  const { ready: authReady, viewer } = useAuthViewerContext();
  const accountCommunity = useCommunityFeed({
    authReady,
    enabled: Boolean(viewer),
    limit: 50,
    savedOnly: true,
    store: communityStore,
    viewer,
  });
  const [hydrated, setHydrated] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [applicationStages, setApplicationStages] =
    useState<JobApplicationStages>({});
  const [socialInteractions, setSocialInteractions] =
    useState<SocialInteractions>(EMPTY_SOCIAL_INTERACTIONS);
  const [localPosts, setLocalPosts] = useState<LocalCommunityPost[]>([]);
  const [jobState, setJobState] = useState<JobRequestState>({ status: "idle" });
  const [activeScope, setActiveScope] = useState<SavedScope>(initialScope);
  const [retryVersion, setRetryVersion] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setSavedJobIds(readSavedJobIds());
    setApplicationStages(readJobApplicationStages());
    setSocialInteractions(readSocialInteractions());
    setLocalPosts(readLocalCommunityPosts());
    setHydrated(true);
    const unsubscribeJobs = subscribeSavedJobs(setSavedJobIds);
    const unsubscribeApplications = subscribeJobApplicationStages(
      setApplicationStages,
    );
    const unsubscribeSocial = subscribeSocialInteractions(
      setSocialInteractions,
    );
    const unsubscribeLocalPosts = subscribeLocalCommunityPosts(setLocalPosts);
    return () => {
      unsubscribeJobs();
      unsubscribeApplications();
      unsubscribeSocial();
      unsubscribeLocalPosts();
    };
  }, []);

  const savedJobKey = savedJobIds.join("\u0000");
  useEffect(() => {
    if (!hydrated) return;
    if (savedJobIds.length === 0) {
      setJobState({
        status: "ready",
        data: { items: [], unavailableIds: [], failedIds: [] },
      });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setJobState({ status: "loading" });

    async function loadSavedJobs() {
      try {
        const response = await fetch("/career/saved/data", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ job_ids: [...savedJobIds].reverse() }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("saved job request failed");
        const data = normalizeSavedJobDataResponse(await response.json());
        if (!cancelled) setJobState({ status: "ready", data });
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          setJobState({ status: "error" });
        }
      }
    }

    void loadSavedJobs();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hydrated, retryVersion, savedJobKey]);

  const legacySavedRecovery = useMemo(
    () =>
      selectSavedCommunityItems(
        socialInteractions.savedPostIds,
        localPosts.map((post) => localCommunityPostToFeedItem(post)),
      ),
    [localPosts, socialInteractions.savedPostIds],
  );
  const serverSavedCommunity = useMemo(() => {
    const savedIds = new Set(accountCommunity.state.viewerState.savedPostIds);
    const items = accountCommunity.state.posts
      .filter((post) => savedIds.has(post.id))
      .map((post) => serverCommunityPostToFeedItem(post));
    return selectSavedCommunityItems(
      items.map((item) => item.id),
      items,
    );
  }, [accountCommunity.state.posts, accountCommunity.state.viewerState.savedPostIds]);
  const visibleSavedJobs = useMemo(() => {
    if (jobState.status !== "ready") return [];
    if (activeScope !== "applications") return jobState.data.items;
    return jobState.data.items.filter((item) => applicationStages[item.id]);
  }, [activeScope, applicationStages, jobState]);

  const jobCount = savedJobIds.length;
  const applicationCount = savedJobIds.filter(
    (id) => applicationStages[id],
  ).length;
  const serverCommunityCount = serverSavedCommunity.items.length;
  const legacyRecoveryCount = legacySavedRecovery.items.length;
  const communityCount = serverCommunityCount + legacyRecoveryCount;
  const totalCount = jobCount + communityCount;
  const accountCommunityLoading = Boolean(
    viewer && accountCommunity.state.status === "loading",
  );
  const accountCommunityUnavailable = Boolean(
    viewer && accountCommunity.state.status === "error",
  );
  const hasCommunityCollectionState =
    accountCommunityLoading || accountCommunityUnavailable;
  const showJobs =
    activeScope === "jobs" ||
    activeScope === "applications" ||
    (activeScope === "all" && jobCount > 0);
  const showCommunity =
    activeScope === "community" ||
    (activeScope === "all" &&
      (serverCommunityCount > 0 || hasCommunityCollectionState));
  const showLegacyRecovery =
    legacyRecoveryCount > 0 &&
    (activeScope === "all" || activeScope === "community");
  const singleCollection =
    Number(showJobs) + Number(showCommunity) + Number(showLegacyRecovery) <= 1;

  function countForScope(scope: SavedScope) {
    if (scope === "jobs") return jobCount;
    if (scope === "applications") return applicationCount;
    if (scope === "community") return communityCount;
    return totalCount;
  }

  function removeJob(item: SavedJobItem) {
    setSavedJobIds(toggleSavedJob(item.id));
    setApplicationStages(removeJobApplicationStage(item.id));
    setAnnouncement(
      `${item.title}을 저장 보관함에서 제거하고 지원 단계도 삭제했습니다.`,
    );
  }

  function updateApplicationStage(
    item: SavedJobItem,
    stage: JobApplicationStageValue,
  ) {
    const nextStages = setJobApplicationStage(item.id, stage);
    setApplicationStages(nextStages);
    if ((nextStages[item.id] ?? "") !== stage) {
      setAnnouncement(
        `${item.title}의 지원 단계를 저장하지 못했습니다.`,
      );
      return;
    }
    setAnnouncement(
      stage
        ? `${item.title}의 지원 단계를 ${applicationStageLabel(stage)}으로 저장했습니다.`
        : `${item.title}의 지원 단계 기록을 삭제했습니다.`,
    );
  }

  async function removeCommunity(item: SavedCommunityItem) {
    if (item.source !== "server") return;
    const removed = await accountCommunity.toggleSaved(item.id);
    setAnnouncement(
      removed
        ? `${item.title}을 계정 저장 보관함에서 제거했습니다.`
        : `${item.title}의 계정 저장 상태를 변경하지 못했습니다.`,
    );
  }

  function removeLegacySave(item: SavedCommunityItem) {
    const wasSaved = socialInteractions.savedPostIds.includes(item.id);
    const next = togglePostSave(item.id);
    setSocialInteractions(next);
    if (next.savedPostIds.includes(item.id) === wasSaved) {
      setAnnouncement(`${item.title}의 저장 상태를 변경하지 못했습니다.`);
      return;
    }
    setAnnouncement(`${item.title}의 이전 기기 저장 표시를 지웠습니다.`);
  }

  function removeUnavailableJobs() {
    if (jobState.status !== "ready") return;
    let nextIds = savedJobIds;
    for (const id of jobState.data.unavailableIds) {
      nextIds = toggleSavedJob(id);
    }
    setSavedJobIds(nextIds);
    setApplicationStages(readJobApplicationStages());
    setAnnouncement("현재 API에서 확인되지 않는 저장 공고를 정리했습니다.");
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % SCOPES.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + SCOPES.length) % SCOPES.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = SCOPES.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveScope(SCOPES[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>내 커리어 보관함</p>
          <h1>저장 보관함</h1>
          <p className={styles.description}>
            공고 저장과 지원 단계는 로그인 전에는 이 브라우저에
            남고, 로그인하면 계정과 동기화됩니다. 실제 커뮤니티 글의 저장은
            로그인 계정에서만 복원합니다. 이전 브라우저 글은 서버 저장과
            섞지 않고 별도 복구 영역에 표시합니다.
          </p>
        </div>
        <div className={styles.introActions}>
          <span>
            <ShieldCheck aria-hidden="true" size={16} weight="fill" />
            {viewer ? "계정 저장 연결됨" : "로그인 시 계정 연동"}
          </span>
          <Link href="/career">
            내 기술 비교
            <ArrowRight aria-hidden="true" size={15} weight="bold" />
          </Link>
        </div>
      </header>

      <div aria-live="polite" className={styles.srOnly}>
        {announcement}
      </div>

      <section aria-label="저장 범위" className={styles.scopeBar}>
        <div className={styles.scopeTabs} role="tablist">
          {SCOPES.map((scope, index) => (
            <button
              aria-controls="saved-library-panel"
              aria-selected={activeScope === scope.value}
              data-active={activeScope === scope.value ? "true" : undefined}
              id={`saved-scope-${scope.value}`}
              key={scope.value}
              onClick={() => setActiveScope(scope.value)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={activeScope === scope.value ? 0 : -1}
              type="button"
            >
              <span>{scope.label}</span>
              <small>{hydrated ? countForScope(scope.value) : "—"}</small>
            </button>
          ))}
        </div>
        <p>
          <BookmarkSimple aria-hidden="true" size={16} weight="fill" />
          서버 저장과 이전 기기 기록을 구분해 표시
        </p>
      </section>

      <div
        aria-labelledby={`saved-scope-${activeScope}`}
        className={styles.panel}
        data-single={singleCollection ? "true" : undefined}
        id="saved-library-panel"
        role="tabpanel"
      >
        {!hydrated ? (
          <div className={styles.loadingState} role="status">
            저장한 항목을 확인하고 있습니다.
          </div>
        ) : totalCount === 0 &&
          !accountCommunityUnavailable &&
          !accountCommunityLoading ? (
          <section className={styles.emptyState} role="status">
            <BookmarkSimple aria-hidden="true" size={28} />
            <h2>아직 저장한 항목이 없습니다.</h2>
            <p>관심 있는 공식 공고와 커뮤니티 글을 저장하면 여기서 다시 볼 수 있습니다.</p>
            <div>
              <Link href="/jobs">
                공식 공고 둘러보기
                <ArrowRight aria-hidden="true" size={15} weight="bold" />
              </Link>
              <Link href="/">
                커뮤니티 보기
                <ArrowRight aria-hidden="true" size={15} weight="bold" />
              </Link>
            </div>
          </section>
        ) : (
          <>
            {showJobs && (
              <section aria-labelledby="saved-jobs-title" className={styles.collection}>
                <header className={styles.collectionHeader}>
                  <div>
                    <p>
                      {activeScope === "applications"
                        ? "지원 단계를 기록한 실제 공고"
                        : "실제 공고 API"}
                    </p>
                    <h2 id="saved-jobs-title">
                      {activeScope === "applications" ? "지원 관리" : "공식 공고"}
                    </h2>
                  </div>
                  <span>
                    {activeScope === "applications"
                      ? `${applicationCount}개 기록`
                      : `${jobCount}개 저장`}
                  </span>
                </header>
                <p className={styles.collectionNote}>
                  {activeScope === "applications"
                    ? "사용자가 선택한 단계만 로컬에 저장하며, 공고 정보는 현재 공식 API와 다시 대조합니다."
                    : "저장한 ID를 현재 공식 공고 상세 응답과 다시 대조합니다."}
                </p>

                {jobState.status === "idle" || jobState.status === "loading" ? (
                  <div className={styles.loadingState} role="status">
                    저장 공고를 현재 API에서 다시 확인하고 있습니다.
                  </div>
                ) : jobState.status === "error" ? (
                  <div className={styles.errorState} role="alert">
                    <WarningCircle aria-hidden="true" size={22} weight="fill" />
                    <div>
                      <strong>저장한 공식 공고를 불러오지 못했습니다.</strong>
                      <p>다른 저장 영역은 계속 볼 수 있으며 공고 내용을 임의로 채우지 않습니다.</p>
                    </div>
                    <button onClick={() => setRetryVersion((value) => value + 1)} type="button">
                      공고 다시 확인
                    </button>
                  </div>
                ) : (
                  <>
                    {jobState.data.unavailableIds.length > 0 && (
                      <div className={styles.dataNotice} role="status">
                        <div>
                          <strong>
                            현재 API에서 확인되지 않는 저장 공고 {jobState.data.unavailableIds.length}개
                          </strong>
                          <p>삭제되었거나 현재 API에서 제공되지 않는 ID입니다.</p>
                        </div>
                        <button onClick={removeUnavailableJobs} type="button">
                          확인 불가 항목 정리
                        </button>
                      </div>
                    )}
                    {jobState.data.failedIds.length > 0 && (
                      <div
                        className={styles.dataNotice}
                        data-warning="true"
                        role="alert"
                      >
                        <div>
                          <strong>
                            저장 공고 {jobState.data.failedIds.length}개를 다시 확인하지 못했습니다.
                          </strong>
                          <p>일시적인 API 오류일 수 있어 저장 상태는 유지했습니다.</p>
                        </div>
                        <button onClick={() => setRetryVersion((value) => value + 1)} type="button">
                          공고 다시 확인
                        </button>
                      </div>
                    )}

                    {visibleSavedJobs.length > 0 ? (
                      <div className={styles.jobList}>
                        {visibleSavedJobs.map((item) => (
                          <SavedJobCard
                            applicationStage={applicationStages[item.id] ?? ""}
                            item={item}
                            key={item.id}
                            onApplicationStageChange={(stage) =>
                              updateApplicationStage(item, stage)
                            }
                            onRemove={() => removeJob(item)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className={styles.compactState} role="status">
                        <Briefcase aria-hidden="true" size={22} />
                        <div>
                          <strong>현재 표시할 공식 공고가 없습니다.</strong>
                          <p>
                            {activeScope === "applications"
                              ? applicationCount === 0
                                ? "지원 단계를 기록한 공고가 없습니다."
                                : "지원 단계는 유지했지만 현재 API에서 확인 가능한 공고가 없습니다."
                              : jobCount === 0
                                ? "공고에서 저장 버튼을 누르면 이곳에 표시됩니다."
                                : "현재 API에서 확인 가능한 저장 공고가 없습니다."}
                          </p>
                        </div>
                        <Link href="/jobs">공고 보기</Link>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {showCommunity && (
              <section
                aria-labelledby="saved-community-title"
                className={styles.collection}
              >
                <header className={styles.collectionHeader}>
                  <div>
                    <p>실제 서버 저장</p>
                    <h2 id="saved-community-title">계정 저장 커뮤니티</h2>
                  </div>
                  <span>{serverCommunityCount}개 저장</span>
                </header>
                <div className={styles.sourceNotice}>
                  <ShieldCheck aria-hidden="true" size={18} weight="fill" />
                  <p>
                    서버가 확인한 계정 게시물만 표시합니다. 읽기 전용 가이드와
                    브라우저 글은 이 개수에 포함하지 않습니다.
                  </p>
                </div>

                {!viewer ? (
                  <div className={styles.compactState}>
                    <ShieldCheck aria-hidden="true" size={22} />
                    <div>
                      <strong>로그인하면 계정에 저장한 글을 볼 수 있습니다.</strong>
                      <p>브라우저에 남은 이전 기록은 아래 복구 영역에서만 표시합니다.</p>
                    </div>
                    <Link href="/login?next=%2Fcareer%2Fsaved">
                      로그인
                    </Link>
                  </div>
                ) : accountCommunityLoading ? (
                  <div className={styles.loadingState} role="status">
                    계정에 저장한 커뮤니티 글을 확인하고 있습니다.
                  </div>
                ) : accountCommunityUnavailable ? (
                  <div className={styles.errorState} role="alert">
                    <WarningCircle aria-hidden="true" size={22} weight="fill" />
                    <div>
                      <strong>계정에 저장한 커뮤니티 글을 불러오지 못했습니다.</strong>
                      <p>이전 기기 복구 기록과 공고 저장은 계속 볼 수 있습니다.</p>
                    </div>
                    <button onClick={() => void accountCommunity.reload()} type="button">
                      커뮤니티 다시 확인
                    </button>
                  </div>
                ) : serverSavedCommunity.items.length > 0 ? (
                  <div className={styles.communityList}>
                    {serverSavedCommunity.items.map((item) => (
                      <article aria-label={item.title} className={styles.communityCard} key={item.id}>
                        <div className={styles.communityTopline}>
                          <span>{item.category}</span>
                          <small data-source="server">계정 저장</small>
                        </div>
                        <h3>
                          <Link href={item.href}>{item.title}</Link>
                        </h3>
                        <p className={styles.communitySummary}>{item.summary}</p>
                        <p className={styles.communityAuthor}>
                          {item.authorName} · {item.authorHeadline} · {item.createdLabel}
                        </p>
                        <ul aria-label={`${item.title} 태그`} className={styles.communityTags}>
                          {item.tags.map((tag) => (
                            <li key={tag}>
                              <Link
                                href={`/search?q=${encodeURIComponent(tag)}&scope=community`}
                              >
                                #{tag}
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <footer className={styles.communityActions}>
                          <Link href={item.href}>
                            글 보기
                            <ArrowRight aria-hidden="true" size={14} weight="bold" />
                          </Link>
                          <button
                            aria-label={`${item.title} 저장 해제`}
                            disabled={accountCommunity.state.pendingKeys.includes(
                              `save:${item.id}`,
                            )}
                            onClick={() => void removeCommunity(item)}
                            type="button"
                          >
                            <Trash aria-hidden="true" size={16} />
                            저장 해제
                          </button>
                        </footer>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.compactState} role="status">
                    <CheckCircle aria-hidden="true" size={22} />
                    <div>
                      <strong>계정에 저장한 커뮤니티 글이 없습니다.</strong>
                      <p>실제 회원 글에서 저장을 누르면 모든 기기에서 다시 볼 수 있습니다.</p>
                    </div>
                    <Link href="/">홈 보기</Link>
                  </div>
                )}
              </section>
            )}

            {showLegacyRecovery && (
              <section
                aria-labelledby="legacy-saved-community-title"
                className={styles.collection}
              >
                <header className={styles.collectionHeader}>
                  <div>
                    <p>현재 브라우저에서만 확인</p>
                    <h2 id="legacy-saved-community-title">
                      이전 기기 저장 글
                    </h2>
                  </div>
                  <span>{legacyRecoveryCount}개 복구</span>
                </header>
                <div className={styles.sourceNotice} data-legacy="true">
                  <WarningCircle aria-hidden="true" size={18} weight="fill" />
                  <p>
                    서버 저장 활동이 아닙니다. 원문을 확인하거나 오래된 저장
                    표시만 지울 수 있습니다.
                  </p>
                </div>
                <div className={styles.communityList}>
                  {legacySavedRecovery.items.map((item) => (
                    <article
                      aria-label={item.title}
                      className={styles.communityCard}
                      key={item.id}
                    >
                      <div className={styles.communityTopline}>
                        <span>{item.category}</span>
                        <small data-source="local">이전 기기 저장</small>
                      </div>
                      <h3>
                        <Link href={item.href}>{item.title}</Link>
                      </h3>
                      <p className={styles.communitySummary}>{item.summary}</p>
                      <p className={styles.communityAuthor}>
                        현재 브라우저 원문 · {item.createdLabel}
                      </p>
                      <footer className={styles.communityActions}>
                        <Link href={item.href}>
                          복구 내용 확인
                          <ArrowRight aria-hidden="true" size={14} weight="bold" />
                        </Link>
                        <button
                          aria-label={`${item.title} 저장 표시 지우기`}
                          onClick={() => removeLegacySave(item)}
                          type="button"
                        >
                          <Trash aria-hidden="true" size={16} />
                          저장 표시 지우기
                        </button>
                      </footer>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
