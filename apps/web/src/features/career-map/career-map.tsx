"use client";

import {
  ArrowRight,
  Briefcase,
  Buildings,
  ChartLineUp,
  Compass,
  Graph,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  buildCareerAnalysis,
  type CareerDirectionKind,
} from "@/features/career-analysis/model";
import type { HomeFeedSnapshot } from "@/features/home-feed/types";
import {
  EMPTY_CAREER_PROFILE,
  readCareerProfile,
  subscribeCareerProfile,
  type CareerProfile,
} from "@/lib/career-profile";
import { readOwnedSkills, subscribeOwnedSkills } from "@/lib/owned-skills";

import styles from "./career-map.module.css";

type CareerMapProps = {
  snapshot: HomeFeedSnapshot;
};

const KIND_LABEL: Record<CareerDirectionKind, string> = {
  direct: "직접 이어지는 방향",
  adjacent: "인접 커리어",
  interest: "관심 분야",
  transition: "전환 폭이 큰 방향",
};

function normalized(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function CareerMap({ snapshot }: CareerMapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedSearch = searchParams.toString();
  const [profile, setProfile] = useState<CareerProfile>(EMPTY_CAREER_PROFILE);
  const [ownedSkills, setOwnedSkills] = useState(snapshot.ownedSkills);
  const analysis = useMemo(
    () =>
      buildCareerAnalysis({
        profile,
        ownedSkills,
        postings: snapshot.analysisPostings ?? [],
      }),
    [ownedSkills, profile, snapshot.analysisPostings],
  );
  const [selectedDomain, setSelectedDomain] = useState("");

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

  useEffect(() => {
    const storedSkills = normalized(ownedSkills);
    if (sameValues(storedSkills, snapshot.ownedSkills)) return;
    const next = new URLSearchParams(serializedSearch);
    next.delete("owned_skills");
    for (const skill of storedSkills) next.append("owned_skills", skill);
    const query = next.toString();
    router.replace("/career-map" + (query ? "?" + query : ""), { scroll: false });
    router.refresh();
  }, [ownedSkills, router, serializedSearch, snapshot.ownedSkills]);

  useEffect(() => {
    if (
      selectedDomain &&
      analysis.directions.some((direction) => direction.domain === selectedDomain)
    ) {
      return;
    }
    setSelectedDomain(analysis.directions[0]?.domain ?? "");
  }, [analysis.directions, selectedDomain]);

  const selected =
    analysis.directions.find((direction) => direction.domain === selectedDomain) ??
    analysis.directions[0] ??
    null;
  const hasInput = Boolean(
    profile.currentRole ||
      profile.responsibilities ||
      profile.experienceHighlights.length > 0 ||
      ownedSkills.length > 0,
  );

  return (
    <main
      className={styles.page}
      data-analysis-snapshot={analysis.snapshotId}
      data-analysis-version={analysis.version}
    >
      <header className={styles.intro}>
        <div>
          <h1>커리어맵</h1>
          <p>
            내 경험에서 이어지는 분야를 같은 기준으로 비교하고, 실제 채용공고까지
            확인합니다.
          </p>
        </div>
        <Link className={styles.technicalLink} href="/skills/graph">
          <Graph aria-hidden="true" size={17} />
          기술 관계 보기
        </Link>
      </header>

      {snapshot.dataStatus === "error" && (
        <div className={styles.notice} role="alert">
          <WarningCircle aria-hidden="true" size={18} />
          채용공고를 불러오지 못했습니다. 저장한 프로필은 유지됩니다.
          <Link href="/career-map">다시 불러오기</Link>
        </div>
      )}

      {!hasInput ? (
        <section className={styles.emptyState}>
          <Compass aria-hidden="true" size={30} />
          <div>
            <h2>커리어 방향을 비교할 정보가 아직 없습니다.</h2>
            <p>현재 직무와 해온 업무를 입력하면 공고 근거가 있는 분야부터 표시합니다.</p>
          </div>
          <Link href="/career">커리어 프로필 입력</Link>
        </section>
      ) : analysis.directions.length === 0 ? (
        <section className={styles.emptyState}>
          <Compass aria-hidden="true" size={30} />
          <div>
            <h2>현재 공고 표본에서 이어지는 분야를 확인하지 못했습니다.</h2>
            <p>주요 업무나 프로젝트·성과 경험을 추가하면 분석 범위가 달라질 수 있습니다.</p>
          </div>
          <Link href="/career">프로필 정보 추가</Link>
        </section>
      ) : (
        <div className={styles.workspace}>
          <section aria-labelledby="direction-list-title" className={styles.directionPanel}>
            <header>
              <h2 id="direction-list-title">비교할 커리어 방향</h2>
              <p>분류, 공고 수, 기업 수를 같은 위치에서 비교합니다.</p>
            </header>
            <div className={styles.directionList}>
              {analysis.directions.map((direction) => (
                <button
                  aria-pressed={selected?.domain === direction.domain}
                  data-selected={
                    selected?.domain === direction.domain ? "true" : undefined
                  }
                  key={direction.domain}
                  onClick={() => setSelectedDomain(direction.domain)}
                  type="button"
                >
                  <span>{KIND_LABEL[direction.kind]}</span>
                  <strong>{direction.label}</strong>
                  <small>
                    공고 {direction.postingCount.toLocaleString("ko-KR")}건 · 기업{" "}
                    {direction.companyCount.toLocaleString("ko-KR")}곳
                  </small>
                </button>
              ))}
            </div>
          </section>

          {selected && (
            <section aria-labelledby="map-detail-title" className={styles.detail}>
              <header className={styles.detailHeader}>
                <div>
                  <span>{KIND_LABEL[selected.kind]}</span>
                  <h2 id="map-detail-title">{selected.label}</h2>
                </div>
                <dl>
                  <div>
                    <dt><Briefcase aria-hidden="true" size={15} /> 공고 수</dt>
                    <dd>{selected.postingCount.toLocaleString("ko-KR")}건</dd>
                  </div>
                  <div>
                    <dt><Buildings aria-hidden="true" size={15} /> 기업 수</dt>
                    <dd>{selected.companyCount.toLocaleString("ko-KR")}곳</dd>
                  </div>
                </dl>
              </header>

              <section className={styles.evidenceSection}>
                <h3>내 경험과 이어지는 이유</h3>
                {selected.reasons.length > 0 ? (
                  <ul>
                    {selected.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p>현재 프로필에서 역할·업무 근거가 제한적입니다.</p>
                )}
              </section>

              <div className={styles.comparisonFacts}>
                <section>
                  <h3>경력 조건 분포</h3>
                  <dl>
                    <div>
                      <dt>신입</dt>
                      <dd>{selected.careerCounts.newComer}건</dd>
                    </div>
                    <div>
                      <dt>경력</dt>
                      <dd>{selected.careerCounts.experienced}건</dd>
                    </div>
                    <div>
                      <dt>신입·경력 또는 미기재</dt>
                      <dd>{selected.careerCounts.mixedOrUnknown}건</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h3>공고에서 확인된 대표 업무</h3>
                  <p>
                    {selected.representativeTasks.length > 0
                      ? selected.representativeTasks.join(" · ")
                      : "공고 요약에서 반복 업무를 확인하지 못했습니다."}
                  </p>
                </section>
              </div>

              <div className={styles.conditionGrid}>
                <section>
                  <h3>활용 가능한 기술</h3>
                  <p>
                    {selected.matchedSkills.length > 0
                      ? selected.matchedSkills.join(" · ")
                      : "현재 프로필에서 확인된 기술 근거가 없습니다."}
                  </p>
                </section>
                <section>
                  <h3>공고에서 추가로 확인된 조건</h3>
                  <p>
                    {selected.additionalRequirements.length > 0
                      ? selected.additionalRequirements.join(" · ")
                      : "반복해서 확인된 추가 기술 조건이 없습니다."}
                  </p>
                </section>
              </div>

              <div className={styles.detailActions}>
                <Link
                  className={styles.primaryAction}
                  href={
                    "/jobs?view=matched&direction=" +
                    encodeURIComponent(selected.domain)
                  }
                >
                  관련 채용공고 보기
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
                <Link href={"/market?field=" + encodeURIComponent(selected.domain)}>
                  <ChartLineUp aria-hidden="true" size={16} />
                  분야별 시장 확인
                </Link>
                {selected.representativeJob ? (
                  <Link href={selected.representativeJob.href}>
                    대표 공고: {selected.representativeJob.companyName} ·{" "}
                    {selected.representativeJob.title}
                  </Link>
                ) : (
                  <span>역할·업무 근거가 분명한 대표 공고는 아직 없습니다.</span>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <section className={styles.methodNote}>
        <ShieldCheck aria-hidden="true" size={19} />
        <div>
          <h2>분석 기준</h2>
          <p>
            커리어 방향은 직무, 맡은 업무, 프로젝트·성과, 산업, 업무 유형, 경력 조건,
            사용 기술과 공개 채용공고를 함께 비교합니다. 기술 관계 그래프는 같은 공고에
            함께 나온 기술을 보여주는 별도 보조 기능이며 커리어 경로나 학습 순서가
            아닙니다.
          </p>
        </div>
        <Link href="/methodology">분석 방법 확인</Link>
      </section>
    </main>
  );
}
