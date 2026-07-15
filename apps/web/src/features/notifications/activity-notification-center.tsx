"use client";

import {
  BookmarkSimple,
  Briefcase,
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

import styles from "./activity-notification-center.module.css";

type ActivityNotificationCenterProps = {
  onNavigate?: () => void;
};

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

  useEffect(() => {
    setSavedJobIds(readSavedJobIds());
    setApplicationStages(readJobApplicationStages());
    setOwnedSkills(readOwnedSkills());
    setHydrated(true);

    const unsubscribeSavedJobs = subscribeSavedJobs(setSavedJobIds);
    const unsubscribeApplications = subscribeJobApplicationStages(
      setApplicationStages,
    );
    const unsubscribeSkills = subscribeOwnedSkills(setOwnedSkills);
    return () => {
      unsubscribeSavedJobs();
      unsubscribeApplications();
      unsubscribeSkills();
    };
  }, []);

  const applicationCount = useMemo(
    () => savedJobIds.filter((id) => applicationStages[id]).length,
    [applicationStages, savedJobIds],
  );
  const stageSummary = useMemo(
    () => applicationSummary(savedJobIds, applicationStages),
    [applicationStages, savedJobIds],
  );
  const hasActivity =
    savedJobIds.length > 0 || applicationCount > 0 || ownedSkills.length > 0;

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
      {applicationCount > 0 && (
        <Link href="/career/saved" onClick={onNavigate}>
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
    </div>
  );
}
