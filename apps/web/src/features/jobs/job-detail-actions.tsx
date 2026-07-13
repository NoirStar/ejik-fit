"use client";

import {
  ArrowSquareOut,
  BookmarkSimple,
  StackSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  readOwnedSkills,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import type { SkillDetail } from "@/lib/types";

import { matchOwnedJobSkills } from "./job-detail-model";
import styles from "./job-detail-actions.module.css";

type JobDetailActionsProps = {
  jobId: string;
  jobTitle: string;
  sourceUrl: string;
  skills: SkillDetail[];
};

export function JobDetailActions({
  jobId,
  jobTitle,
  sourceUrl,
  skills,
}: JobDetailActionsProps) {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);

  useEffect(() => {
    setSavedIds(readSavedJobIds());
    setOwnedSkills(readOwnedSkills());

    const stopSavedSubscription = subscribeSavedJobs(setSavedIds);
    const stopOwnedSubscription = subscribeOwnedSkills(setOwnedSkills);
    return () => {
      stopSavedSubscription();
      stopOwnedSubscription();
    };
  }, []);

  const matchedSkills = useMemo(
    () => matchOwnedJobSkills(skills, ownedSkills),
    [ownedSkills, skills],
  );
  const saved = savedIds.includes(jobId);

  return (
    <section
      aria-labelledby="job-actions-title"
      className={styles.panel}
    >
      <header className={styles.header}>
        <p>공식 원문에서 계속</p>
        <h2 id="job-actions-title">지원 준비</h2>
      </header>

      <a
        className={styles.apply}
        href={sourceUrl}
        rel="noreferrer"
        target="_blank"
      >
        공식 채용페이지에서 지원
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

      <div aria-live="polite" className={styles.overlap}>
        <StackSimple aria-hidden="true" size={19} weight="bold" />
        <div>
          <h3>내 기술 비교</h3>
          {ownedSkills.length === 0 ? (
            <>
              <p>저장한 기술이 없어 아직 비교하지 않았습니다.</p>
              <Link href="/career">내 기술 저장하기</Link>
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
