"use client";

import {
  ArrowSquareOut,
  BookmarkSimple,
  CheckCircle,
  StackSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  APPLICATION_STAGES,
  applicationStageLabel,
  readJobApplicationStages,
  setJobApplicationStage,
  subscribeJobApplicationStages,
  type JobApplicationStageValue,
  type JobApplicationStages,
} from "@/lib/job-application-stages";
import {
  readOwnedSkills,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import { PRODUCT_TERMS } from "@/lib/labels";
import type { SkillDetail } from "@/lib/types";

import { matchOwnedJobSkills } from "./job-detail-model";
import styles from "./job-detail-actions.module.css";

type JobDetailActionsProps = {
  jobId: string;
  jobTitle: string;
  sourceUrl: string;
  status: string;
  skills: SkillDetail[];
};

export function JobDetailActions({
  jobId,
  jobTitle,
  sourceUrl,
  status,
  skills,
}: JobDetailActionsProps) {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);
  const [applicationStages, setApplicationStages] =
    useState<JobApplicationStages>({});
  const [stageAnnouncement, setStageAnnouncement] = useState("");

  useEffect(() => {
    setSavedIds(readSavedJobIds());
    setOwnedSkills(readOwnedSkills());
    setApplicationStages(readJobApplicationStages());

    const stopSavedSubscription = subscribeSavedJobs(setSavedIds);
    const stopOwnedSubscription = subscribeOwnedSkills(setOwnedSkills);
    const stopStageSubscription = subscribeJobApplicationStages(
      setApplicationStages,
    );
    return () => {
      stopSavedSubscription();
      stopOwnedSubscription();
      stopStageSubscription();
    };
  }, []);

  const matchedSkills = useMemo(
    () => matchOwnedJobSkills(skills, ownedSkills),
    [ownedSkills, skills],
  );
  const saved = savedIds.includes(jobId);
  const applicationStage = applicationStages[jobId] ?? "";
  const acceptsApplications = status === "open";

  function updateApplicationStage(stage: JobApplicationStageValue) {
    if (stage && !readSavedJobIds().includes(jobId)) {
      const nextSavedIds = toggleSavedJob(jobId);
      setSavedIds(nextSavedIds);
      if (!nextSavedIds.includes(jobId)) {
        setStageAnnouncement(
          "브라우저 저장이 허용되지 않아 지원 단계를 기록하지 못했습니다.",
        );
        return;
      }
    }

    const nextStages = setJobApplicationStage(jobId, stage);
    setApplicationStages(nextStages);
    if ((nextStages[jobId] ?? "") !== stage) {
      setStageAnnouncement("지원 단계를 기록하지 못했습니다.");
      return;
    }
    setStageAnnouncement(
      stage
        ? `${applicationStageLabel(stage)}로 기록했습니다.`
        : "지원 단계 기록을 삭제했습니다.",
    );
  }

  return (
    <section
      aria-labelledby="job-actions-title"
      className={styles.panel}
    >
      <header className={styles.header}>
        <p>
          {acceptsApplications
            ? "공식 원문에서 계속"
            : "마감 여부를 공식 원문에서 확인"}
        </p>
        <h2 id="job-actions-title">
          {acceptsApplications ? "지원 준비" : "공고 확인"}
        </h2>
      </header>

      <div aria-label="지원 및 저장" className={styles.primaryActions} role="group">
        <a
          className={styles.apply}
          href={sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          공식 채용페이지에서 {acceptsApplications ? "지원" : "확인"}
          <ArrowSquareOut aria-hidden="true" size={18} weight="bold" />
        </a>
        <button
          aria-label={`${jobTitle} ${saved ? "저장 해제" : "저장"}`}
          aria-pressed={saved}
          className={styles.save}
          onClick={() => setSavedIds(toggleSavedJob(jobId))}
          type="button"
        >
          <BookmarkSimple
            aria-hidden="true"
            size={19}
            weight={saved ? "fill" : "regular"}
          />
          {saved ? "저장됨" : "공고 저장"}
        </button>
      </div>

      <div
        className={styles.applicationTracker}
        data-active={applicationStage ? "true" : undefined}
      >
        <div className={styles.trackerHeading}>
          <CheckCircle aria-hidden="true" size={18} weight="bold" />
          <div>
            <h3>지원 단계</h3>
            <p>공고별 진행 상태를 기록합니다.</p>
          </div>
        </div>
        <select
          aria-label={`${jobTitle} 지원 단계`}
          onChange={(event) =>
            updateApplicationStage(
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
        <p aria-live="polite" className={styles.stageStatus}>
          {stageAnnouncement ||
            (applicationStage
              ? `${applicationStageLabel(applicationStage)} · 로그인 시 계정과 동기화됩니다.`
              : `선택하면 공고도 ${PRODUCT_TERMS.savedItems}에 함께 추가됩니다.`)}
        </p>
      </div>

      <div aria-live="polite" className={styles.overlap}>
        <StackSimple aria-hidden="true" size={19} weight="bold" />
        <div>
          <h3>{PRODUCT_TERMS.ownedSkills} 비교</h3>
          {ownedSkills.length === 0 ? (
            <>
              <p>내 기술을 추가하면 공고의 기술 요건과 비교합니다.</p>
              <Link href="/career">내 기술 추가</Link>
            </>
          ) : (
            <>
              <strong>내 기술과 겹침 {matchedSkills.length}개</strong>
              {matchedSkills.length > 0 ? (
                <ul aria-label="공고와 겹치는 내 기술" role="list">
                  {matchedSkills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              ) : (
                <p>확정 기술 중 정확히 일치하는 항목이 없습니다.</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
