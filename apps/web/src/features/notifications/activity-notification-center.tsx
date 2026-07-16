"use client";

import {
  BookmarkSimple,
  Briefcase,
  Buildings,
  ChartLineUp,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
import { normalizePostingList } from "@/lib/posting-contract";
import type { PostingSummary } from "@/lib/types";

import styles from "./activity-notification-center.module.css";

type ActivityNotificationCenterProps = {
  onNavigate?: () => void;
};

type RecentCompanyJobsState =
  | { status: "idle" | "loading" }
  | { status: "ready"; items: PostingSummary[] }
  | { status: "error" };

const COMPANY_JOBS_CHECKED_AT_KEY =
  "ejik-fit:company-job-notifications-checked-at";
const INITIAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1_000;

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
  onNavigate,
}: ActivityNotificationCenterProps) {
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
  const hasActivity =
    savedJobIds.length > 0 ||
    applicationCount > 0 ||
    ownedSkills.length > 0 ||
    followedCompanySlugs.length > 0;

  if (!hydrated) {
    return (
      <div className={styles.state} role="status">
        <strong>내 활동을 확인하고 있습니다.</strong>
      </div>
    );
  }

  if (!hasActivity) {
    return (
      <div className={styles.state} role="status">
        <strong>아직 확인할 활동이 없습니다.</strong>
        <span>기술이나 공고를 저장하면 여기에서 바로 이어볼 수 있어요.</span>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {recentCompanyJobs.status === "ready" &&
        recentCompanyJobs.items.map((job) => (
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
            <small>{stageSummary || "저장한 지원 단계를 확인하세요."}</small>
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
            <small>공고 상태와 마감일을 다시 확인해 보세요.</small>
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
            <small>현재 열린 공식 공고를 다시 확인해 보세요.</small>
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
            <small>현재 공고에서 기술별 수요를 비교해 보세요.</small>
          </span>
        </Link>
      )}

      {recentCompanyJobs.status === "loading" && (
        <p className={styles.jobAlertStatus} role="status">
          관심 기업의 새 공고를 확인하고 있습니다.
        </p>
      )}
      {recentCompanyJobs.status === "error" && (
        <p className={styles.jobAlertStatus} role="status">
          관심 기업의 최근 공고를 지금은 확인하지 못했습니다.
        </p>
      )}
    </div>
  );
}
