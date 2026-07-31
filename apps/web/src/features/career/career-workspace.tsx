"use client";

import { ArrowRight, BookmarkSimple, Briefcase, CheckCircle, Trash, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useCareerAnalysis } from "@/features/career-analysis/use-career-analysis";
import {
  resolvedSkillKey,
  resolveSkillInput,
  SkillPicker,
} from "@/features/owned-skills/skill-picker";
import {
  EMPTY_CAREER_PROFILE,
  readCareerProfile,
  subscribeCareerProfile,
  type CareerProfile,
} from "@/lib/career-profile";
import {
  addOwnedSkill,
  MAX_OWNED_SKILL_LENGTH,
  MAX_OWNED_SKILLS,
  readOwnedSkills,
  removeOwnedSkill,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import type { SkillCatalogItem } from "@/lib/types";

import type { CareerDomainSuggestion } from "./model";
import { CareerProfileEditor } from "./career-profile-editor";
import styles from "./career-workspace.module.css";

const KIND_LABEL = {
  direct: "직접 이어지는 방향",
  adjacent: "인접 커리어",
  interest: "관심 분야",
  transition: "전환 폭이 큰 방향",
} as const;

type CareerWorkspaceProps = {
  catalog: SkillCatalogItem[];
  catalogUnavailable: boolean;
  domains: CareerDomainSuggestion[];
};

function hasProfile(profile: CareerProfile, ownedSkills: string[]) {
  return Boolean(
    profile.currentRole ||
      profile.responsibilities ||
      profile.experienceHighlights.length > 0 ||
      ownedSkills.length > 0,
  );
}

export function CareerWorkspace({
  catalog,
  catalogUnavailable,
  domains,
}: CareerWorkspaceProps) {
  const [profile, setProfile] = useState<CareerProfile>(EMPTY_CAREER_PROFILE);
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");
  const [skillError, setSkillError] = useState("");
  const configured = hasProfile(profile, ownedSkills);
  const analysis = useCareerAnalysis(profile, ownedSkills, {
    enabled: hydrated && configured,
    limit: 4,
  });

  useEffect(() => {
    setProfile(readCareerProfile());
    setOwnedSkills(readOwnedSkills());
    setHydrated(true);
    const unsubscribeProfile = subscribeCareerProfile(setProfile);
    const unsubscribeSkills = subscribeOwnedSkills(setOwnedSkills);
    return () => {
      unsubscribeProfile();
      unsubscribeSkills();
    };
  }, []);

  function saveSkill(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setSkillError("기술 이름을 입력해 주세요.");
      return false;
    }
    if (trimmed.length > MAX_OWNED_SKILL_LENGTH) {
      setSkillError(`기술 이름은 ${MAX_OWNED_SKILL_LENGTH}자 이하로 입력해 주세요.`);
      return false;
    }
    const resolved = resolveSkillInput(trimmed, catalog);
    const key = resolvedSkillKey(resolved, catalog);
    if (ownedSkills.some((skill) => resolvedSkillKey(skill, catalog) === key)) {
      setSkillError("이미 추가한 기술입니다.");
      return false;
    }
    if (ownedSkills.length >= MAX_OWNED_SKILLS) {
      setSkillError(`기술은 최대 ${MAX_OWNED_SKILLS}개까지 추가할 수 있습니다.`);
      return false;
    }
    setOwnedSkills(addOwnedSkill(resolved));
    setSkillDraft("");
    setSkillError("");
    return true;
  }

  const result = analysis.status === "ready" ? analysis.data! : null;

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <h1>내 커리어</h1>
          <p>지금까지 해온 일에서 이어지는 방향과 실제 채용공고를 먼저 확인합니다.</p>
        </div>
        <nav aria-label="내 커리어 보조 메뉴">
          <Link href="/career/saved"><BookmarkSimple aria-hidden="true" size={16} />저장한 공고</Link>
          <Link href="/career-map">방향 비교</Link>
        </nav>
      </header>

      {configured ? (
        <section aria-labelledby="career-result-heading" className={styles.results}>
          <header>
            <div>
              <span><CheckCircle aria-hidden="true" size={16} weight="fill" />저장된 프로필 기준</span>
              <h2 id="career-result-heading">
                {profile.currentRole ? `${profile.currentRole} 경험에서 확인한 방향` : "내 경험에서 확인한 방향"}
              </h2>
            </div>
            {result ? (
              <p>
                공개 채용공고 {result.analyzed_posting_count.toLocaleString("ko-KR")}건 ·
                기업 {result.analyzed_company_count.toLocaleString("ko-KR")}곳
              </p>
            ) : null}
          </header>

          {analysis.status === "loading" || analysis.status === "idle" ? (
            <div className={styles.state} role="status">
              <strong>전체 채용공고와 내 경험을 비교하고 있습니다.</strong>
              <p>직무, 주요 업무, 경력과 필수 조건을 함께 확인합니다.</p>
            </div>
          ) : analysis.status === "error" ? (
            <div className={styles.state} role="alert">
              <WarningCircle aria-hidden="true" size={20} />
              <strong>분석을 불러오지 못했습니다.</strong>
              <p>저장한 프로필은 유지됩니다.</p>
              <button onClick={analysis.retry} type="button">분석 다시 불러오기</button>
            </div>
          ) : result!.directions.length === 0 ? (
            <div className={styles.state}>
              <strong>현재 데이터에서 근거가 분명한 방향을 확인하지 못했습니다.</strong>
              <p>주요 업무나 프로젝트 경험을 추가하면 비교 범위가 달라질 수 있습니다.</p>
            </div>
          ) : (
            <>
              <div className={styles.directionList}>
                {result!.directions.slice(0, 3).map((direction) => (
                  <article key={direction.domain}>
                    <span>{KIND_LABEL[direction.kind]}</span>
                    <h3>{direction.label}</h3>
                    <p>{direction.reasons[0]}</p>
                    <dl>
                      <div><dt>공고 수</dt><dd>{direction.posting_count.toLocaleString("ko-KR")}건</dd></div>
                      <div><dt>기업 수</dt><dd>{direction.company_count.toLocaleString("ko-KR")}곳</dd></div>
                    </dl>
                    <Link href={`/jobs?view=matched&direction=${encodeURIComponent(direction.domain)}`}>
                      관련 채용공고 보기 <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                  </article>
                ))}
              </div>
              <section className={styles.jobs}>
                <header>
                  <h3>지금 확인할 채용공고</h3>
                  <Link href="/jobs?view=matched">추천 채용공고 전체 보기</Link>
                </header>
                {result!.recommendations.items.length ? (
                  <ul>
                    {result!.recommendations.items.slice(0, 4).map(({ posting, connection }) => (
                      <li key={posting.id}>
                        <Link href={`/jobs/${encodeURIComponent(posting.id)}`}>
                          <span>{posting.company_name}</span>
                          <strong>{posting.title}</strong>
                          <small>{connection.reasons[0]}</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>경력과 공고 조건이 함께 맞는 공고를 아직 확인하지 못했습니다.</p>
                )}
              </section>
            </>
          )}
        </section>
      ) : (
        <section className={styles.start}>
          <Briefcase aria-hidden="true" size={24} />
          <div>
            <h2>최소 프로필부터 입력해 주세요.</h2>
            <p>현재 직무, 경력 기간, 주요 업무만으로 분석을 시작할 수 있습니다.</p>
          </div>
        </section>
      )}

      <details className={styles.editor} open={!configured}>
        <summary>{configured ? "프로필과 기술 수정" : "커리어 프로필 입력"}</summary>
        <div className={styles.editorBody}>
          <CareerProfileEditor domains={domains} ownedSkills={ownedSkills} />
          <section aria-labelledby="career-skills-heading" className={styles.skills}>
            <header>
              <div>
                <h2 id="career-skills-heading">실제로 사용한 기술</h2>
                <p>공고 조건과 비교할 기술만 입력합니다.</p>
              </div>
              <span>{ownedSkills.length}개</span>
            </header>
            <SkillPicker
              catalog={catalog}
              catalogStatus={catalogUnavailable ? "error" : "ready"}
              error={skillError}
              excludedSkills={ownedSkills}
              id="career-skill-picker"
              onCommit={saveSkill}
              onValueChange={(value) => {
                setSkillDraft(value);
                setSkillError("");
              }}
              value={skillDraft}
            />
            {ownedSkills.length ? (
              <ul aria-label="사용 기술 목록">
                {ownedSkills.map((skill) => (
                  <li key={skill}>
                    <span>{skill}</span>
                    <button
                      aria-label={`${skill} 제거`}
                      onClick={() => setOwnedSkills(removeOwnedSkill(skill))}
                      type="button"
                    >
                      <Trash aria-hidden="true" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.noSkills}>입력한 기술이 없습니다.</p>}
          </section>
        </div>
      </details>
    </main>
  );
}
