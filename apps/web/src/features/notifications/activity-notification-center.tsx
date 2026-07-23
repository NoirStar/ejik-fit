"use client";

import {
  BookmarkSimple,
  Briefcase,
  Buildings,
  ChartLineUp,
  ChatCircle,
  UserPlus,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import { CompanyMark } from "@/features/home-feed/company-mark";
import { useSavedJobSearches } from "@/features/saved-searches/use-saved-job-searches";
import { useSavedSearchEvaluation } from "@/features/saved-searches/use-saved-search-evaluation";
import {
  applicationStageLabel,
  readJobApplicationStages,
  subscribeJobApplicationStages,
  type JobApplicationStages,
} from "@/lib/job-application-stages";
import {
  readOwnedSkills,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import {
  readSavedJobIds,
  subscribeSavedJobs,
} from "@/lib/saved-jobs";
import {
  readFollowedCompanySlugs,
  subscribeFollowedCompanies,
} from "@/lib/followed-companies";
import { notificationReason } from "@/lib/activity-notifications";
import { normalizePostingList } from "@/lib/posting-contract";
import { flattenSavedSearchNotifications } from "@/lib/saved-search-notifications";
import type { PostingSummary } from "@/lib/types";

import styles from "./activity-notification-center.module.css";
import type { ActivityNotificationsController } from "./use-activity-notifications";

type ActivityNotificationCenterProps = {
  notifications?: ActivityNotificationsController;
  onNavigate?: () => void;
  viewer?: AuthViewer | null;
};

type RecentCompanyJobsState =
  | { status: "idle" | "loading" }
  | { status: "ready"; items: PostingSummary[] }
  | { status: "error" };

const COMPANY_JOBS_CHECKED_AT_KEY =
  "ejik-fit:company-job-notifications-checked-at";
const INITIAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_SAVED_SEARCH_NOTIFICATIONS = 5;

function notificationCheckpoint(now: number) {
  try {
    const value = window.localStorage.getItem(COMPANY_JOBS_CHECKED_AT_KEY);
    const parsed = value ? Date.parse(value) : Number.NaN;
    if (Number.isFinite(parsed) && parsed <= now) return parsed;
  } catch {
    // A blocked local store should not hide current job data.
  }
  return now - INITIAL_LOOKBACK_MS;
}

function saveNotificationCheckpoint(now: number) {
  try {
    window.localStorage.setItem(
      COMPANY_JOBS_CHECKED_AT_KEY,
      new Date(now).toISOString(),
    );
  } catch {
    // Notifications remain usable for the current open menu.
  }
}

function applicationSummary(
  savedJobIds: string[],
  stages: JobApplicationStages,
) {
  const counts = new Map<string, number>();
  for (const id of savedJobIds) {
    const stage = stages[id];
    if (!stage) continue;
    const label = applicationStageLabel(stage);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => `${label} ${count}건`)
    .slice(0, 2)
    .join(" · ");
}

export function ActivityNotificationCenter({
  notifications,
  onNavigate,
  viewer = null,
}: ActivityNotificationCenterProps) {
  const savedSearches = useSavedJobSearches(viewer);
  const savedSearchEvaluation = useSavedSearchEvaluation(
    savedSearches.state.items,
    savedSearches.state.status,
    savedSearches.markChecked,
  );
  const [hydrated, setHydrated] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [applicationStages, setApplicationStages] =
    useState<JobApplicationStages>({});
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);
  const [followedCompanySlugs, setFollowedCompanySlugs] = useState<string[]>([]);
  const [recentCompanyJobs, setRecentCompanyJobs] =
    useState<RecentCompanyJobsState>({ status: "idle" });

  useEffect(() => {
    setSavedJobIds(readSavedJobIds());
    setApplicationStages(readJobApplicationStages());
    setOwnedSkills(readOwnedSkills());
    setFollowedCompanySlugs(readFollowedCompanySlugs());
    setHydrated(true);

    const unsubscribeSavedJobs = subscribeSavedJobs(setSavedJobIds);
    const unsubscribeApplications = subscribeJobApplicationStages(
      setApplicationStages,
    );
    const unsubscribeSkills = subscribeOwnedSkills(setOwnedSkills);
    const unsubscribeCompanies = subscribeFollowedCompanies(
      setFollowedCompanySlugs,
    );
    return () => {
      unsubscribeSavedJobs();
      unsubscribeApplications();
      unsubscribeSkills();
      unsubscribeCompanies();
    };
  }, []);

  const followedCompanyKey = followedCompanySlugs.join("\u0000");
  useEffect(() => {
    if (!hydrated || followedCompanySlugs.length === 0) {
      setRecentCompanyJobs({ status: "ready", items: [] });
      return;
    }

    const controller = new AbortController();
    const checkedAt = notificationCheckpoint(Date.now());
    setRecentCompanyJobs({ status: "loading" });

    async function loadRecentCompanyJobs() {
      try {
        const response = await fetch("/notifications/company-jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ company_slugs: followedCompanySlugs }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("company job request failed");
        const postings = normalizePostingList(await response.json());
        const items = postings.items
          .filter((posting) => {
            if (!posting.first_seen_at) return false;
            const discoveredAt = Date.parse(posting.first_seen_at);
            return Number.isFinite(discoveredAt) && discoveredAt > checkedAt;
          })
          .slice(0, 3);
        setRecentCompanyJobs({ status: "ready", items });

        if (
          postings.items.length === 0 ||
          postings.items.some((posting) => posting.first_seen_at)
        ) {
          saveNotificationCheckpoint(Date.now());
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRecentCompanyJobs({ status: "error" });
        }
      }
    }

    void loadRecentCompanyJobs();
    return () => controller.abort();
  }, [followedCompanyKey, followedCompanySlugs, hydrated]);

  const applicationCount = useMemo(
    () => savedJobIds.filter((id) => applicationStages[id]).length,
    [applicationStages, savedJobIds],
  );
  const stageSummary = useMemo(
    () => applicationSummary(savedJobIds, applicationStages),
    [applicationStages, savedJobIds],
  );
  const persistedJobIds = useMemo(
    () =>
      new Set(
        (notifications?.state.items ?? [])
          .map((notification) =>
            notification.href.match(/^\/jobs\/([^/?#]+)$/)?.[1],
          )
          .filter((id): id is string => Boolean(id)),
      ),
    [notifications?.state.items],
  );
  const savedSearchNotifications = useMemo(
    () =>
      flattenSavedSearchNotifications(
        savedSearchEvaluation.state.groups,
        savedSearches.state.items,
        MAX_SAVED_SEARCH_NOTIFICATIONS,
      ).filter(
        (notification) => !persistedJobIds.has(notification.job.id),
      ),
    [
      persistedJobIds,
      savedSearchEvaluation.state.groups,
      savedSearches.state.items,
    ],
  );
  const savedSearchesLoading =
    savedSearches.state.status === "loading" ||
    (savedSearches.state.items.length > 0 &&
      savedSearchEvaluation.state.status === "loading");
  const hasSavedSearchActivity =
    savedSearches.state.items.length > 0 ||
    savedSearches.state.status === "loading" ||
    savedSearches.state.status === "error";
  const hasActivity =
    (notifications?.state.items.length ?? 0) > 0 ||
    notifications?.state.status === "loading" ||
    notifications?.state.status === "error" ||
    hasSavedSearchActivity ||
    savedJobIds.length > 0 ||
    applicationCount > 0 ||
    ownedSkills.length > 0 ||
    followedCompanySlugs.length > 0;

  if (!hydrated) {
    return (
      <div className={styles.state} role="status">
        <strong>알림을 불러오는 중…</strong>
      </div>
    );
  }

  if (!hasActivity) {
    return (
      <div className={styles.state} role="status">
        <strong>새 알림이 없습니다.</strong>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {(notifications?.state.items.length ?? 0) > 0 && (
        <div className={styles.persistentHeader}>
          <span>계정 새 소식</span>
          {notifications && notifications.unreadCount > 0 && (
            <button
              onClick={() => void notifications.markAllRead()}
              type="button"
            >
              모두 읽음
            </button>
          )}
        </div>
      )}

      {notifications?.state.items.map((notification) => (
        <Link
          className={styles.persistedNotification}
          data-read={notification.readAt ? "true" : "false"}
          href={notification.href}
          key={notification.id}
          onClick={() => {
            void notifications.markRead(notification.id);
            onNavigate?.();
          }}
        >
          <span
            className={styles.icon}
            data-tone={
              notification.kind === "job"
                ? "new-job"
                : notification.metadata.action === "comment"
                  ? "community-comment"
                  : "community-follow"
            }
          >
            {notification.kind === "job" ? (
              <Briefcase aria-hidden="true" size={18} weight="fill" />
            ) : notification.metadata.action === "comment" ? (
              <ChatCircle aria-hidden="true" size={18} weight="fill" />
            ) : (
              <UserPlus aria-hidden="true" size={18} weight="fill" />
            )}
          </span>
          <span className={styles.copy}>
            <span className={styles.notificationReason}>
              {notificationReason(notification)}
            </span>
            <strong>{notification.title}</strong>
            <small>{notification.body}</small>
          </span>
        </Link>
      ))}

      {savedSearchNotifications.map((notification) => {
        const primarySearch = notification.searches[0];
        const additionalSearches = notification.searches.length - 1;
        const searchName = additionalSearches
          ? `${primarySearch.name} 외 ${additionalSearches}개`
          : primarySearch.name;

        return (
          <Link
            className={styles.savedSearchJob}
            href={`/jobs/${encodeURIComponent(notification.job.id)}`}
            key={notification.job.id}
            onClick={onNavigate}
          >
            <CompanyMark
              companyName={notification.job.company_name}
              size={32}
              sourceUrl={notification.job.source_url}
            />
            <span className={styles.savedSearchCopy}>
              <span className={styles.savedSearchName}>
                공고 알림 · {searchName}
              </span>
              <strong>
                {notification.job.company_name} · {notification.job.title}
              </strong>
              <small>이직핏이 새로 확인</small>
            </span>
          </Link>
        );
      })}

      {savedSearches.state.items.length > 0 && (
        <Link
          className={styles.savedSearchMore}
          href="/career/alerts"
          onClick={onNavigate}
        >
          공고 알림에서 더 보기
        </Link>
      )}

      {recentCompanyJobs.status === "ready" &&
        recentCompanyJobs.items
          .filter((job) => !persistedJobIds.has(job.id))
          .map((job) => (
          <Link
            href={`/jobs/${encodeURIComponent(job.id)}`}
            key={job.id}
            onClick={onNavigate}
          >
            <span className={styles.icon} data-tone="new-job">
              <Briefcase aria-hidden="true" size={18} weight="fill" />
            </span>
            <span className={styles.copy}>
              <strong>{job.company_name} · 새로 확인</strong>
              <small>{job.title}</small>
            </span>
          </Link>
          ))}

      {applicationCount > 0 && (
        <Link href="/career/saved?scope=applications" onClick={onNavigate}>
          <span className={styles.icon} data-tone="application">
            <Briefcase aria-hidden="true" size={18} weight="fill" />
          </span>
          <span className={styles.copy}>
            <strong>지원 기록 {applicationCount}건</strong>
            <small>{stageSummary || "지원 단계별 현황을 봅니다."}</small>
          </span>
        </Link>
      )}

      {savedJobIds.length > 0 && (
        <Link href="/career/saved" onClick={onNavigate}>
          <span className={styles.icon} data-tone="saved">
            <BookmarkSimple aria-hidden="true" size={18} weight="fill" />
          </span>
          <span className={styles.copy}>
            <strong>저장한 공고 {savedJobIds.length}건</strong>
            <small>공고 상태와 마감일을 확인합니다.</small>
          </span>
        </Link>
      )}

      {followedCompanySlugs.length > 0 && (
        <Link href="/career/companies" onClick={onNavigate}>
          <span className={styles.icon} data-tone="companies">
            <Buildings aria-hidden="true" size={18} weight="fill" />
          </span>
          <span className={styles.copy}>
            <strong>관심 기업 {followedCompanySlugs.length}개</strong>
            <small>현재 열린 공식 공고를 확인합니다.</small>
          </span>
        </Link>
      )}

      {ownedSkills.length > 0 && (
        <Link href="/market" onClick={onNavigate}>
          <span className={styles.icon} data-tone="skills">
            <ChartLineUp aria-hidden="true" size={18} weight="bold" />
          </span>
          <span className={styles.copy}>
            <strong>내 기술 {ownedSkills.length}개</strong>
            <small>현재 공고의 기술 수요를 비교합니다.</small>
          </span>
        </Link>
      )}

      {recentCompanyJobs.status === "loading" && (
        <p className={styles.jobAlertStatus} role="status">
          관심 기업의 새 공고를 불러오는 중…
        </p>
      )}
      {recentCompanyJobs.status === "error" && (
        <p className={styles.jobAlertStatus} role="status">
          관심 기업의 최근 공고를 지금은 확인하지 못했습니다.
        </p>
      )}
      {savedSearchesLoading && (
        <p className={styles.jobAlertStatus} role="status">
          공고 알림의 새 공고를 불러오는 중…
        </p>
      )}
      {savedSearches.state.status === "error" && (
        <div className={styles.retryStatus} role="status">
          <span>공고 알림을 불러오지 못했습니다.</span>
          <button onClick={() => void savedSearches.reload()} type="button">
            다시 확인
          </button>
        </div>
      )}
      {(savedSearchEvaluation.state.status === "partial" ||
        savedSearchEvaluation.state.status === "error") && (
        <div className={styles.retryStatus} role="status">
          <span>
            {savedSearchEvaluation.state.status === "partial"
              ? "일부 공고 알림을 확인하지 못했습니다."
              : "공고 알림을 확인하지 못했습니다."}
          </span>
          <button
            onClick={savedSearchEvaluation.refresh}
            type="button"
          >
            공고 알림 다시 확인
          </button>
        </div>
      )}
      {notifications?.state.status === "loading" && (
        <p className={styles.jobAlertStatus} role="status">
          계정 알림을 불러오는 중…
        </p>
      )}
      {notifications?.state.status === "error" && (
        <div className={styles.retryStatus} role="status">
          <span>계정 알림을 불러오지 못했습니다.</span>
          <button onClick={() => void notifications.reload()} type="button">
            다시 확인
          </button>
        </div>
      )}
    </div>
  );
}
