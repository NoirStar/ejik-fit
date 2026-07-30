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
  EMPTY_CAREER_PROFILE,
  readCareerProfile,
  subscribeCareerProfile,
  type CareerProfile,
} from "@/lib/career-profile";
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
import type { PostingSummary, SkillDetail } from "@/lib/types";

import { matchOwnedJobSkills } from "./job-detail-model";
import { buildJobConnection } from "./model";
import styles from "./job-detail-actions.module.css";

type JobDetailActionsProps = {
  job: PostingSummary;
  skills: SkillDetail[];
};

export function JobDetailActions({
  job,
  skills,
}: JobDetailActionsProps) {
  const jobId = job.id;
  const jobTitle = job.title;
  const sourceUrl = job.source_url;
  const status = job.status;
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);
  const [profile, setProfile] = useState<CareerProfile>(EMPTY_CAREER_PROFILE);
  const [applicationStages, setApplicationStages] =
    useState<JobApplicationStages>({});
  const [stageAnnouncement, setStageAnnouncement] = useState("");

  useEffect(() => {
    setSavedIds(readSavedJobIds());
    setOwnedSkills(readOwnedSkills());
    setProfile(readCareerProfile());
    setApplicationStages(readJobApplicationStages());

    const stopSavedSubscription = subscribeSavedJobs(setSavedIds);
    const stopOwnedSubscription = subscribeOwnedSkills(setOwnedSkills);
    const stopProfileSubscription = subscribeCareerProfile(setProfile);
    const stopStageSubscription = subscribeJobApplicationStages(
      setApplicationStages,
    );
    return () => {
      stopSavedSubscription();
      stopOwnedSubscription();
      stopProfileSubscription();
      stopStageSubscription();
    };
  }, []);

  const matchedSkills = useMemo(
    () => matchOwnedJobSkills(skills, ownedSkills),
    [ownedSkills, skills],
  );
  const connection = useMemo(
    () =>
      buildJobConnection(
        {
          ...job,
          required_skills: skills
            .filter((skill) => skill.requirement_type === "required")
            .map((skill) => skill.skill),
          preferred_skills: skills
            .filter((skill) => skill.requirement_type === "preferred")
            .map((skill) => skill.skill),
          unspecified_skills: skills
            .filter((skill) => skill.requirement_type === "unspecified")
            .map((skill) => skill.skill),
        },
        ownedSkills,
        profile,
      ),
    [job, ownedSkills, profile, skills],
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
            ? "공식 채용 페이지"
            : "공식 채용 페이지에서 마감 여부 확인"}
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
          공식 채용 페이지에서 {acceptsApplications ? "지원" : "확인"}
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
              : "선택하면 공고도 저장 목록에 함께 추가됩니다.")}
        </p>
      </div>

      <div aria-live="polite" className={styles.overlap}>
        <StackSimple aria-hidden="true" size={19} weight="bold" />
        <div>
          <h3>내 커리어와 연결되는 이유</h3>
          {ownedSkills.length === 0 && !profile.currentRole ? (
            <>
              <p>{connection.reason}</p>
              <Link href="/career">프로필 정보 추가</Link>
            </>
          ) : (
            <>
              <strong>{connection.label}</strong>
              <p>{connection.reason}</p>
              {matchedSkills.length > 0 ? (
                <ul aria-label="공고와 겹치는 내 기술" role="list">
                  {matchedSkills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              ) : (
                <p>현재 프로필에서 정확히 일치하는 기술은 확인되지 않았습니다.</p>
              )}
              {connection.unconfirmedRequiredSkills.length > 0 ? (
                <p>
                  현재 프로필에서 확인되지 않은 필수 조건:{" "}
                  {connection.unconfirmedRequiredSkills.join(" · ")}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
