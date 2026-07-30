"use client";

import {
  ArrowRight,
  Briefcase,
  ChartLineUp,
  CheckCircle,
  Compass,
  MapPin,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  CareerDirectionSummary,
  HomeFeedSnapshot,
  RecommendedJobFeedItem,
} from "@/features/home-feed/types";
import {
  careerAnalysisLevel,
  EMPTY_CAREER_PROFILE,
  readCareerProfile,
  subscribeCareerProfile,
  type CareerProfile,
} from "@/lib/career-profile";

import styles from "./career-home.module.css";

type CareerHomeProps = {
  snapshot: HomeFeedSnapshot;
};

type DirectionKind = "direct" | "adjacent" | "explore" | "transition";

const DIRECTION_LABELS: Record<DirectionKind, string> = {
  direct: "현재 경력을 직접 이어가는 방향",
  adjacent: "경험 활용도가 높은 인접 커리어",
  explore: "관심을 바탕으로 탐색 가능한 방향",
  transition: "경력 전환 폭이 큰 방향",
};

function hasProfile(profile: CareerProfile) {
  return Boolean(
    profile.currentRole ||
      profile.responsibilities ||
      profile.currentDomain ||
      profile.interestDomains.length > 0,
  );
}

function directionKind(
  direction: CareerDirectionSummary,
  profile: CareerProfile,
): DirectionKind {
  if (profile.currentDomain && profile.currentDomain === direction.domain) {
    return "direct";
  }
  if (profile.interestDomains.includes(direction.domain)) return "explore";
  if (direction.coveredSkills.length >= 2) return "adjacent";
  return "transition";
}

function formattedVerifiedAt(value: string | null) {
  if (!value) return "최근 확인 시점 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근 확인 시점 없음";
  return `${new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date)} 확인`;
}

function JobCard({ job }: { job: RecommendedJobFeedItem }) {
  const overlap = [
    ...job.matchedRequiredSkills,
    ...job.matchedPreferredSkills,
  ];
  const limited = overlap.length <= 1;

  return (
    <article className={styles.jobCard}>
      <div className={styles.jobTopline}>
        <span>{limited ? "연결 근거 제한적" : "내 경험과 연결되는 공고"}</span>
        <span>{job.verifiedLabel} 확인</span>
      </div>
      <div className={styles.jobHeading}>
        <div>
          <p>{job.companyName}</p>
          <h3>
            <Link href={job.href}>{job.title}</Link>
          </h3>
        </div>
        <ArrowRight aria-hidden="true" size={20} />
      </div>
      <div className={styles.jobMeta}>
        <span>
          <MapPin aria-hidden="true" size={15} />
          {job.location}
        </span>
        <span>{job.careerLabel}</span>
        <span>{job.employmentLabel}</span>
      </div>
      {overlap.length > 0 ? (
        <p className={styles.jobReason}>
          <strong>연결되는 기술</strong>
          {overlap.join(", ")}
        </p>
      ) : (
        <p className={styles.jobReason}>
          현재 프로필에서 겹치는 기술은 확인되지 않았습니다. 공고 상세에서 업무와
          조건을 직접 확인해 주세요.
        </p>
      )}
      {job.missingRequiredSkills.length > 0 && (
        <p className={styles.unconfirmed}>
          <strong>프로필에서 확인되지 않은 조건</strong>
          {job.missingRequiredSkills.join(", ")}
        </p>
      )}
    </article>
  );
}

function DataScope({ snapshot }: CareerHomeProps) {
  return (
    <section aria-labelledby="data-scope-title" className={styles.scope}>
      <div>
        <ShieldCheck aria-hidden="true" size={20} weight="duotone" />
        <div>
          <h2 id="data-scope-title">분석 데이터의 범위</h2>
          <p>
            수집된 기업 공식 채용 페이지의 공개 공고를 기준으로 하며, 대한민국 전체
            채용시장을 대표하지 않습니다.
          </p>
        </div>
      </div>
      <dl>
        <div>
          <dt>현재 분석에 포함된 공고</dt>
          <dd>{snapshot.postingCount.toLocaleString("ko-KR")}건</dd>
        </div>
        <div>
          <dt>확인한 출처</dt>
          <dd>{snapshot.sourceCount.toLocaleString("ko-KR")}곳</dd>
        </div>
        <div>
          <dt>데이터 시점</dt>
          <dd>{formattedVerifiedAt(snapshot.lastVerifiedAt)}</dd>
        </div>
      </dl>
      <Link href="/data-policy">수집 범위와 처리 기준 확인</Link>
    </section>
  );
}

function EmptyProfileHome({ snapshot }: CareerHomeProps) {
  return (
    <>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>경력과 채용공고를 함께 보는 커리어 분석</p>
        <h1>내 경력과 기술이 이어지는 커리어 방향을 확인하세요</h1>
        <p className={styles.heroDescription}>
          현재 직무와 실제로 해온 일, 사용 기술을 입력하면 연결되는 커리어 분야와
          그 판단에 사용한 채용공고를 함께 보여드립니다.
        </p>
        <Link className={styles.primaryAction} href="/career">
          내 커리어 분석하기
          <ArrowRight aria-hidden="true" size={18} weight="bold" />
        </Link>
      </section>

      <section aria-labelledby="how-title" className={styles.howItWorks}>
        <div className={styles.sectionHeading}>
          <p>확인할 수 있는 것</p>
          <h2 id="how-title">세 단계로 판단 근거까지 확인합니다</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <strong>경력과 기술 입력</strong>
            <p>최소한의 기술부터 시작하고, 직무와 업무 경험은 나중에 더할 수 있습니다.</p>
          </li>
          <li>
            <span>02</span>
            <strong>커리어 방향과 연결 근거 확인</strong>
            <p>직접 이어지는 분야와 인접 분야, 탐색 범위가 큰 분야를 구분합니다.</p>
          </li>
          <li>
            <span>03</span>
            <strong>관련 채용공고와 시장 확인</strong>
            <p>실제 공고 수와 기업, 조건을 확인하고 공식 채용 페이지로 이동할 수 있습니다.</p>
          </li>
        </ol>
      </section>

      {snapshot.recommendedJobs.length > 0 && (
        <section aria-labelledby="recent-jobs-title" className={styles.section}>
          <div className={styles.sectionHeadingRow}>
            <div className={styles.sectionHeading}>
              <p>최근 확인한 공개 채용공고</p>
              <h2 id="recent-jobs-title">프로필 없이도 공고 범위를 살펴볼 수 있습니다</h2>
            </div>
            <Link href="/jobs">전체 채용공고 보기</Link>
          </div>
          <div className={styles.jobGrid}>
            {snapshot.recommendedJobs.slice(0, 2).map((job) => (
              <JobCard job={job} key={job.id} />
            ))}
          </div>
        </section>
      )}

      <p className={styles.sampleSummary}>
        공개 채용공고 {snapshot.postingCount.toLocaleString("ko-KR")}건과 출처 {snapshot.sourceCount.toLocaleString("ko-KR")}곳을 현재 화면의 분석 범위에서 확인했습니다.
      </p>
      <DataScope snapshot={snapshot} />
    </>
  );
}

function ProfileHome({ profile, snapshot }: CareerHomeProps & { profile: CareerProfile }) {
  const orderedDirections = useMemo(
    () =>
      snapshot.careerDirections
        .map((direction) => ({
          ...direction,
          kind: directionKind(direction, profile),
        }))
        .sort((left, right) => {
          const rank: Record<DirectionKind, number> = {
            direct: 0,
            adjacent: 1,
            explore: 2,
            transition: 3,
          };
          return rank[left.kind] - rank[right.kind] || right.postingCount - left.postingCount;
        }),
    [profile, snapshot.careerDirections],
  );
  const title = profile.currentRole
    ? `${profile.currentRole} 경험에서 이어갈 방향`
    : "입력한 기술에서 이어갈 커리어 방향";

  return (
    <>
      <section className={styles.profileHero}>
        <div>
          <p className={styles.eyebrow}>내 커리어</p>
          <h1>{title}</h1>
          <p>
            입력한 경험과 수집된 공개 채용공고를 비교한 결과입니다. 연결 근거와 확인
            범위를 함께 보고 판단해 주세요.
          </p>
        </div>
        <div className={styles.profileActions}>
          <span>
            <CheckCircle aria-hidden="true" size={16} weight="fill" />
            {careerAnalysisLevel(profile)}
          </span>
          <Link href="/career">프로필 정보 추가</Link>
        </div>
      </section>

      <section aria-labelledby="directions-title" className={styles.section}>
        <div className={styles.sectionHeadingRow}>
          <div className={styles.sectionHeading}>
            <p>먼저 볼 결론</p>
            <h2 id="directions-title">내 경험과 연결되는 커리어 방향</h2>
          </div>
          <Link href="/skill-map">커리어맵에서 비교하기</Link>
        </div>

        {orderedDirections.length > 0 ? (
          <div className={styles.directionGrid}>
            {orderedDirections.slice(0, 4).map((direction, index) => (
              <article
                className={styles.directionCard}
                data-primary={index === 0 ? "true" : undefined}
                key={direction.domain}
              >
                <div className={styles.directionTopline}>
                  <span data-kind={direction.kind}>{DIRECTION_LABELS[direction.kind]}</span>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3>{direction.label}</h3>
                <p className={styles.directionReason}>
                  {direction.coveredSkills.length > 0
                    ? `${direction.coveredSkills.join(", ")} 경험이 포함된 공개 채용공고에서 연결 근거를 확인했습니다.`
                    : "관심 분야와 연결된 공개 채용공고를 탐색 범위로 확인했습니다."}
                </p>
                <dl>
                  <div>
                    <dt>공고</dt>
                    <dd>공고 {direction.postingCount.toLocaleString("ko-KR")}건</dd>
                  </div>
                  <div>
                    <dt>기업</dt>
                    <dd>확인된 기업 {direction.confirmedCompanyCount.toLocaleString("ko-KR")}곳</dd>
                  </div>
                </dl>
                {direction.additionalRequirements.length > 0 && (
                  <p className={styles.additionalRequirements}>
                    <strong>공고에서 추가로 확인되는 요구사항</strong>
                    {direction.additionalRequirements.slice(0, 4).join(", ")}
                  </p>
                )}
                <div className={styles.directionLinks}>
                  <Link href={`/jobs?q=${encodeURIComponent(direction.label)}`}>
                    관련 공고 보기
                  </Link>
                  {direction.representativeJob && (
                    <Link href={direction.representativeJob.href}>
                      {direction.representativeJob.companyName} · {direction.representativeJob.title}
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Compass aria-hidden="true" size={28} weight="duotone" />
            <div>
              <h3>현재 입력으로 연결되는 분야를 확인하지 못했습니다</h3>
              <p>
                분석에 포함된 공고가 없거나 기술 근거가 충분하지 않습니다. 해온 업무를
                추가하면 경력 기준으로 다시 확인할 수 있습니다.
              </p>
            </div>
            <Link href="/career">프로필 정보 추가</Link>
          </div>
        )}
      </section>

      <section aria-labelledby="market-summary-title" className={styles.marketStrip}>
        <div>
          <ChartLineUp aria-hidden="true" size={22} weight="duotone" />
          <div>
            <p>시장 근거</p>
            <h2 id="market-summary-title">현재 분석 조건의 공개 채용공고</h2>
          </div>
        </div>
        <dl>
          <div>
            <dt>확인된 공고</dt>
            <dd>{snapshot.postingCount.toLocaleString("ko-KR")}건</dd>
          </div>
          <div>
            <dt>출처</dt>
            <dd>{snapshot.sourceCount.toLocaleString("ko-KR")}곳</dd>
          </div>
          <div>
            <dt>최근 확인</dt>
            <dd>{formattedVerifiedAt(snapshot.lastVerifiedAt)}</dd>
          </div>
        </dl>
        <Link href="/market">분야별 시장 확인</Link>
      </section>

      <section aria-labelledby="connected-jobs-title" className={styles.section}>
        <div className={styles.sectionHeadingRow}>
          <div className={styles.sectionHeading}>
            <p>실제 채용공고</p>
            <h2 id="connected-jobs-title">내 경험과 조건을 비교할 공고</h2>
          </div>
          <Link href="/jobs?view=matched">관련 채용공고 모두 보기</Link>
        </div>
        {snapshot.recommendedJobs.length > 0 ? (
          <div className={styles.jobGrid}>
            {snapshot.recommendedJobs.slice(0, 2).map((job) => (
              <JobCard job={job} key={job.id} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Briefcase aria-hidden="true" size={28} weight="duotone" />
            <div>
              <h3>현재 조건과 연결된 공개 채용공고가 없습니다</h3>
              <p>수집 범위에 공고가 없거나 확인 중입니다. 전체 공고에서 조건을 바꿔 탐색할 수 있습니다.</p>
            </div>
            <Link href="/jobs">전체 채용공고 보기</Link>
          </div>
        )}
      </section>

      <DataScope snapshot={snapshot} />
    </>
  );
}

export function CareerHome({ snapshot }: CareerHomeProps) {
  const [profile, setProfile] = useState<CareerProfile>(EMPTY_CAREER_PROFILE);

  useEffect(() => {
    setProfile(readCareerProfile());
    return subscribeCareerProfile(setProfile);
  }, []);

  const configured = snapshot.ownedSkills.length > 0 || hasProfile(profile);

  return (
    <main className={styles.page}>
      {snapshot.dataStatus === "error" && (
        <section className={styles.errorState} role="alert">
          <WarningCircle aria-hidden="true" size={22} weight="fill" />
          <div>
            <strong>채용공고와 시장 데이터를 불러오지 못했습니다</strong>
            <p>
              브라우저에 저장된 커리어 정보는 유지됩니다. 잠시 후 다시 시도하거나 전체
              채용공고를 직접 확인해 주세요.
            </p>
            <Link href="/jobs">전체 채용공고 직접 보기</Link>
          </div>
        </section>
      )}
      {snapshot.dataStatus === "partial" && (
        <section className={styles.partialState} role="status">
          <WarningCircle aria-hidden="true" size={19} />
          <p>일부 데이터를 불러오지 못해 확인된 결과만 표시합니다.</p>
        </section>
      )}
      {configured ? (
        <ProfileHome profile={profile} snapshot={snapshot} />
      ) : (
        <EmptyProfileHome snapshot={snapshot} />
      )}
    </main>
  );
}
