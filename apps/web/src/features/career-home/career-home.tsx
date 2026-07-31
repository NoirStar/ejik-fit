"use client";

import {
  ArrowRight,
  Briefcase,
  ChartLineUp,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useCareerAnalysis } from "@/features/career-analysis/use-career-analysis";
import type { HomeFeedSnapshot } from "@/features/home-feed/types";
import {
  careerAnalysisLevel,
  EMPTY_CAREER_PROFILE,
  readCareerProfile,
  subscribeCareerProfile,
  type CareerProfile,
} from "@/lib/career-profile";
import { formatEmployment, formatLocation } from "@/lib/labels";
import {
  readOwnedSkills,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import type {
  CareerAnalysisDirection,
  CareerDirectionKind,
} from "@/lib/types";

import { formatCareerRange, formatVerifiedDate } from "../jobs/model";
import styles from "./career-home.module.css";

type CareerHomeProps = {
  snapshot: HomeFeedSnapshot;
};

const DIRECTION_LABELS: Record<CareerDirectionKind, string> = {
  direct: "직접 이어지는 방향",
  adjacent: "인접 커리어",
  interest: "관심 분야",
  transition: "전환 폭이 큰 방향",
};

function hasProfile(profile: CareerProfile, ownedSkills: string[]) {
  return Boolean(
    profile.currentRole ||
      profile.responsibilities ||
      profile.experienceHighlights.length > 0 ||
      ownedSkills.length > 0,
  );
}

function formattedVerifiedAt(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "갱신 시점 확인 불가";
  return (
    new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Seoul",
    }).format(new Date(value)) + " 기준"
  );
}

function DirectionCard({ direction }: { direction: CareerAnalysisDirection }) {
  return (
    <article className={styles.directionCard} data-kind={direction.kind}>
      <div className={styles.cardLabel}>{DIRECTION_LABELS[direction.kind]}</div>
      <h3>{direction.label}</h3>
      <p>
        {direction.reasons[0] ??
          "현재 프로필과 수집된 채용공고에서 확인할 근거가 제한적입니다."}
      </p>
      <dl>
        <div>
          <dt>공고 수</dt>
          <dd>{direction.posting_count.toLocaleString("ko-KR")}건</dd>
        </div>
        <div>
          <dt>기업 수</dt>
          <dd>{direction.company_count.toLocaleString("ko-KR")}곳</dd>
        </div>
      </dl>
      <div className={styles.cardActions}>
        <Link
          href={
            "/jobs?view=matched&direction=" +
            encodeURIComponent(direction.domain)
          }
        >
          관련 채용공고 보기
        </Link>
        {direction.representative_job ? (
          <Link href={`/jobs/${encodeURIComponent(direction.representative_job.id)}`}>
            대표 공고: {direction.representative_job.title}
          </Link>
        ) : (
          <span>역할·업무 근거가 분명한 대표 공고는 아직 없습니다.</span>
        )}
      </div>
    </article>
  );
}

function EmptyProfileHome({ snapshot }: CareerHomeProps) {
  const postingsUnavailable =
    snapshot.dataStatus === "error" || snapshot.dataStatus === "partial";

  return (
    <section className={styles.onboarding}>
      <div>
        <h1>내 경험에서 이어갈 커리어 방향을 확인하세요</h1>
        <p>
          지금까지 맡은 업무와 사용 기술을 입력하면 이어갈 수 있는 분야와 관련
          채용공고를 실제 공고 근거와 함께 보여드립니다.
        </p>
        <Link className={styles.primaryAction} href="/career">
          내 커리어 분석하기
          <ArrowRight aria-hidden="true" size={18} weight="bold" />
        </Link>
      </div>
      <aside aria-label="분석 결과 예시" className={styles.resultExample}>
        <span>결과에서 확인할 내용</span>
        <strong>직접 이어지는 방향 · 인접 커리어</strong>
        <p>왜 이어지는지, 공고와 기업이 얼마나 확인되는지 함께 비교합니다.</p>
      </aside>
      <p className={styles.scopeLine}>
        {postingsUnavailable
          ? "채용공고 분석 범위를 불러오지 못했습니다. 잠시 뒤 다시 확인해 주세요."
          : `현재 수집된 공식 채용공고 ${snapshot.postingCount.toLocaleString("ko-KR")}건 기준 · 대한민국 전체 채용시장을 대표하지 않습니다.`}
      </p>
    </section>
  );
}

function ProfileHome({
  profile,
  snapshot,
  ownedSkills,
}: CareerHomeProps & { profile: CareerProfile; ownedSkills: string[] }) {
  const analysisState = useCareerAnalysis(profile, ownedSkills, { limit: 4 });

  if (analysisState.status === "loading" || analysisState.status === "idle") {
    return (
      <section className={styles.emptyState} role="status">
        <strong>내 경험과 전체 채용공고를 비교하고 있습니다.</strong>
        <p>직무, 업무, 경력 조건과 확인된 기술 조건을 함께 살펴봅니다.</p>
      </section>
    );
  }
  if (analysisState.status === "error") {
    return (
      <section className={styles.errorState} role="alert">
        <WarningCircle aria-hidden="true" size={20} weight="fill" />
        <div>
          <strong>커리어 분석을 불러오지 못했습니다.</strong>
          <p>저장된 프로필은 유지됩니다. 전체 채용공고는 계속 확인할 수 있습니다.</p>
        </div>
        <button onClick={analysisState.retry} type="button">분석 다시 불러오기</button>
      </section>
    );
  }

  const analysis = analysisState.data!;
  const directions = analysis.directions.slice(0, 2);
  const jobs = analysis.recommendations.items.slice(0, 4);

  return (
    <div
      data-analysis-snapshot={analysis.snapshot_id}
      data-analysis-version={analysis.version}
    >
      <header className={styles.dashboardHeader}>
        <div>
          <span className={styles.analysisLevel}>
            <CheckCircle aria-hidden="true" size={15} weight="fill" />
            {careerAnalysisLevel(profile)}
          </span>
          <h1>
            {profile.currentRole
              ? profile.currentRole + " 경험에서 이어갈 방향"
              : "내 경험에서 이어갈 커리어 방향"}
          </h1>
          <p>입력한 경험과 같은 시점의 공개 채용공고를 비교한 결과입니다.</p>
        </div>
        <Link href="/career">프로필 정보 추가</Link>
      </header>

      <section aria-labelledby="home-directions-title" className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="home-directions-title">먼저 확인할 커리어 방향</h2>
            <p>역할과 업무 근거가 분명한 방향부터 표시합니다.</p>
          </div>
          <Link href="/career-map">모든 방향 비교</Link>
        </div>
        {directions.length > 0 ? (
          <div className={styles.directionGrid}>
            {directions.map((direction) => (
              <DirectionCard direction={direction} key={direction.domain} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>현재 공고 표본에서 이어지는 방향을 확인하지 못했습니다.</strong>
            <p>
              프로필의 주요 업무나 프로젝트·성과 경험을 추가하면 분석 범위를 넓힐
              수 있습니다.
            </p>
            <Link href="/career">프로필 정보 추가</Link>
          </div>
        )}
      </section>

      <section aria-labelledby="home-jobs-title" className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="home-jobs-title">새로 확인할 관련 채용공고</h2>
            <p>기술 하나가 아니라 역할·업무 근거가 함께 확인된 공고입니다.</p>
          </div>
          <Link href="/jobs?view=matched">추천 채용공고 전체 보기</Link>
        </div>
        {jobs.length > 0 ? (
          <ul className={styles.jobList}>
            {jobs.map(({ posting: job, connection }) => {
              return (
                <li key={job.id}>
                  <Link href={"/jobs/" + encodeURIComponent(job.id)}>
                    <div>
                      <span>{job.company_name}</span>
                      <h3>{job.title}</h3>
                    </div>
                    <p>{connection.reasons[0]}</p>
                    <div className={styles.jobMeta}>
                      <span>{connection.direction_label}</span>
                      <span>{formatCareerRange(job)}</span>
                      <span>{formatEmployment(job.employment_type)}</span>
                      <span>{formatLocation(job.location)}</span>
                      <span>{formatVerifiedDate(job.last_verified_at)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            <Briefcase aria-hidden="true" size={22} />
            <strong>역할·업무 근거가 확인된 추천 공고가 없습니다.</strong>
            <p>전체 채용공고는 직접 검색하고 조건을 비교할 수 있습니다.</p>
            <Link href="/jobs">전체 채용공고 찾기</Link>
          </div>
        )}
      </section>

      <section
        aria-labelledby="home-market-title"
        className={styles.marketSummary}
      >
        <ChartLineUp aria-hidden="true" size={20} />
        <div>
          <h2 id="home-market-title">현재 확인한 시장 표본</h2>
          <p>
            분석 가능한 공개 채용공고 {analysis.analyzed_posting_count.toLocaleString("ko-KR")}건 ·
            서로 다른 기업 {analysis.analyzed_company_count.toLocaleString("ko-KR")}곳 ·{" "}
            {formattedVerifiedAt(analysis.calculated_at)}
          </p>
        </div>
        <Link href="/market">분야별 채용 현황 보기</Link>
      </section>

      {analysis.profile_information_not_confirmed.length > 0 && (
        <p className={styles.profileNotice}>
          현재 프로필에서 확인되지 않은 정보:{" "}
          {analysis.profile_information_not_confirmed.join(", ")}. 입력하면 비교할 근거의
          범위가 달라질 수 있습니다.
        </p>
      )}
    </div>
  );
}

export function CareerHome({ snapshot }: CareerHomeProps) {
  const [profile, setProfile] = useState<CareerProfile>(EMPTY_CAREER_PROFILE);
  const [ownedSkills, setOwnedSkills] = useState(snapshot.ownedSkills);

  useEffect(() => {
    setProfile(readCareerProfile());
    const storedSkills = readOwnedSkills();
    setOwnedSkills(storedSkills.length > 0 ? storedSkills : snapshot.ownedSkills);
    const unsubscribeProfile = subscribeCareerProfile(setProfile);
    const unsubscribeSkills = subscribeOwnedSkills(setOwnedSkills);
    return () => {
      unsubscribeProfile();
      unsubscribeSkills();
    };
  }, [snapshot.ownedSkills]);

  const configured = hasProfile(profile, ownedSkills);
  const hasDataError =
    snapshot.dataStatus === "error" || snapshot.dataStatus === "partial";

  return (
    <main className={styles.page}>
      {hasDataError && !configured && (
        <section className={styles.errorState} role="alert">
          <WarningCircle aria-hidden="true" size={20} weight="fill" />
          <div>
            <strong>채용공고를 불러오지 못했습니다.</strong>
            <p>브라우저에 저장된 프로필은 유지됩니다. 잠시 뒤 다시 불러와 주세요.</p>
          </div>
          <Link href="/">채용공고 다시 불러오기</Link>
        </section>
      )}
      {configured ? (
        <ProfileHome
          ownedSkills={ownedSkills}
          profile={profile}
          snapshot={snapshot}
        />
      ) : (
        <EmptyProfileHome snapshot={snapshot} />
      )}
    </main>
  );
}
