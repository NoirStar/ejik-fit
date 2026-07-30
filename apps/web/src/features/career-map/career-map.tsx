"use client";

import {
  ArrowRight,
  Briefcase,
  Buildings,
  ChartLineUp,
  Compass,
  Graph,
  ShieldCheck,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type {
  CareerDirectionSummary,
  HomeFeedSnapshot,
} from "@/features/home-feed/types";
import {
  EMPTY_CAREER_PROFILE,
  readCareerProfile,
  subscribeCareerProfile,
  type CareerProfile,
} from "@/lib/career-profile";
import { readOwnedSkills } from "@/lib/owned-skills";

import styles from "./career-map.module.css";

type CareerMapProps = {
  snapshot: HomeFeedSnapshot;
};

type DirectionKind = "direct" | "adjacent" | "explore" | "transition";

const KIND_LABEL: Record<DirectionKind, string> = {
  direct: "현재 경력을 직접 이어가는 방향",
  adjacent: "경험 활용도가 높은 인접 커리어",
  explore: "관심을 바탕으로 탐색 가능한 방향",
  transition: "경력 전환 폭이 큰 방향",
};

function normalized(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function kindForDirection(
  direction: CareerDirectionSummary,
  profile: CareerProfile,
): DirectionKind {
  if (profile.currentDomain === direction.domain) return "direct";
  if (profile.interestDomains.includes(direction.domain)) return "explore";
  if (direction.coveredSkills.length >= 2) return "adjacent";
  return "transition";
}

export function CareerMap({ snapshot }: CareerMapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedSearch = searchParams.toString();
  const [profile, setProfile] = useState<CareerProfile>(EMPTY_CAREER_PROFILE);
  const [selectedDomain, setSelectedDomain] = useState(
    snapshot.careerDirections[0]?.domain ?? "",
  );

  useEffect(() => {
    setProfile(readCareerProfile());
    return subscribeCareerProfile(setProfile);
  }, []);

  useEffect(() => {
    const storedSkills = normalized(readOwnedSkills());
    if (sameValues(storedSkills, snapshot.ownedSkills)) return;

    const next = new URLSearchParams(serializedSearch);
    next.delete("owned_skills");
    for (const skill of storedSkills) next.append("owned_skills", skill);
    const query = next.toString();
    router.replace(`/skill-map${query ? `?${query}` : ""}`, { scroll: false });
    router.refresh();
  }, [router, serializedSearch, snapshot.ownedSkills]);

  useEffect(() => {
    if (
      selectedDomain &&
      snapshot.careerDirections.some((direction) => direction.domain === selectedDomain)
    ) {
      return;
    }
    setSelectedDomain(snapshot.careerDirections[0]?.domain ?? "");
  }, [selectedDomain, snapshot.careerDirections]);

  const directions = useMemo(
    () =>
      snapshot.careerDirections.map((direction) => ({
        ...direction,
        kind: kindForDirection(direction, profile),
      })),
    [profile, snapshot.careerDirections],
  );
  const selected =
    directions.find((direction) => direction.domain === selectedDomain) ??
    directions[0] ??
    null;
  const hasInput = snapshot.ownedSkills.length > 0 || Boolean(profile.currentRole);

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p>내 경험에서 분야와 공고로</p>
          <h1>커리어맵</h1>
          <span>
            현재 경력과 기술을 중심으로 연결 근거가 확인된 커리어 분야를 비교합니다.
          </span>
        </div>
        <Link className={styles.technicalLink} href="/skills/graph">
          <Graph aria-hidden="true" size={18} />
          기술 관계 보기
        </Link>
      </header>

      {snapshot.dataStatus === "partial" && (
        <div className={styles.notice} role="status">
          <WarningCircle aria-hidden="true" size={18} />
          일부 데이터를 불러오지 못해 확인된 커리어 방향만 표시합니다.
        </div>
      )}

      {!hasInput ? (
        <section className={styles.emptyState}>
          <Compass aria-hidden="true" size={34} weight="duotone" />
          <div>
            <h2>커리어맵을 만들 정보가 아직 없습니다</h2>
            <p>
              현재 직무나 사용 기술을 입력하면 공개 채용공고에서 연결 근거가 확인된
              분야를 표시합니다.
            </p>
          </div>
          <Link href="/career">커리어 프로필 입력</Link>
        </section>
      ) : directions.length === 0 ? (
        <section className={styles.emptyState}>
          <Compass aria-hidden="true" size={34} weight="duotone" />
          <div>
            <h2>현재 입력과 연결된 분야를 확인하지 못했습니다</h2>
            <p>
              수집된 공고에 연결 근거가 없거나 데이터를 확인 중입니다. 프로필의 업무
              경험을 보완한 뒤 다시 확인해 주세요.
            </p>
          </div>
          <Link href="/career">프로필 정보 추가</Link>
        </section>
      ) : (
        <>
          <section aria-label="내 커리어 방향 지도" className={styles.mapStage}>
            <div className={styles.centerNode}>
              <UserCircle aria-hidden="true" size={26} weight="duotone" />
              <span>현재 프로필</span>
              <strong>{profile.currentRole || "입력한 기술"}</strong>
              <small>
                {profile.experienceYears !== null
                  ? `경력 ${profile.experienceYears}년`
                  : `${snapshot.ownedSkills.length}개 기술`}
              </small>
            </div>
            {directions.slice(0, 5).map((direction, index) => (
              <button
                aria-pressed={selected?.domain === direction.domain}
                className={styles.directionNode}
                data-kind={direction.kind}
                data-selected={selected?.domain === direction.domain ? "true" : undefined}
                data-slot={index}
                key={direction.domain}
                onClick={() => setSelectedDomain(direction.domain)}
                type="button"
              >
                <span>{KIND_LABEL[direction.kind]}</span>
                <strong>{direction.label}</strong>
                <small>{direction.postingCount.toLocaleString("ko-KR")}개 공고 근거</small>
              </button>
            ))}
          </section>

          {selected && (
            <section aria-labelledby="map-detail-title" className={styles.detail}>
              <header>
                <div>
                  <p>{KIND_LABEL[selected.kind]}</p>
                  <h2 id="map-detail-title">{selected.label}</h2>
                </div>
                <div className={styles.counts}>
                  <span>
                    <Briefcase aria-hidden="true" size={16} />
                    관련 공고 {selected.postingCount.toLocaleString("ko-KR")}건
                  </span>
                  <span>
                    <Buildings aria-hidden="true" size={16} />
                    확인된 기업 {selected.confirmedCompanyCount.toLocaleString("ko-KR")}곳
                  </span>
                </div>
              </header>

              <div className={styles.evidenceGrid}>
                <div>
                  <h3>사용자와 연결되는 이유</h3>
                  <p>
                    {selected.coveredSkills.length > 0
                      ? `${selected.coveredSkills.join(", ")} 경험이 포함된 공개 채용공고에서 이 분야와의 연결을 확인했습니다.`
                      : "입력한 관심 분야와 연결된 공개 채용공고가 확인됐습니다."}
                  </p>
                </div>
                <div>
                  <h3>활용 가능한 기술</h3>
                  {selected.coveredSkills.length > 0 ? (
                    <ul>
                      {selected.coveredSkills.map((skill) => (
                        <li key={skill}>{skill}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>현재 프로필에서 확인된 기술이 없습니다.</p>
                  )}
                </div>
                <div>
                  <h3>공고에서 추가로 확인되는 요구사항</h3>
                  {selected.additionalRequirements.length > 0 ? (
                    <ul>
                      {selected.additionalRequirements.slice(0, 6).map((skill) => (
                        <li key={skill}>{skill}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>반복해서 확인된 추가 기술 조건이 없습니다.</p>
                  )}
                </div>
              </div>

              <div className={styles.detailActions}>
                <Link href={`/jobs?q=${encodeURIComponent(selected.label)}`}>
                  관련 채용공고 보기
                  <ArrowRight aria-hidden="true" size={16} weight="bold" />
                </Link>
                <Link href={`/market?field=${encodeURIComponent(selected.domain)}`}>
                  <ChartLineUp aria-hidden="true" size={16} />
                  시장 근거 확인
                </Link>
                {selected.representativeJob && (
                  <Link href={selected.representativeJob.href}>
                    {selected.representativeJob.companyName} · {selected.representativeJob.title}
                  </Link>
                )}
              </div>
            </section>
          )}
        </>
      )}

      <section className={styles.methodNote}>
        <ShieldCheck aria-hidden="true" size={20} weight="duotone" />
        <div>
          <h2>관계의 의미</h2>
          <p>
            기술 관계는 같은 채용공고에 함께 등장한 조건을 바탕으로 합니다. 기술 간
            인과관계, 커리어 경로나 학습 순서를 뜻하지 않습니다. 공고 수와 기업 수는
            수집된 공개 채용공고 안에서만 해석해야 합니다.
          </p>
        </div>
        <Link href="/methodology">분석 방법 확인</Link>
      </section>
    </main>
  );
}
