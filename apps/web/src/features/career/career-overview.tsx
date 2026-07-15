"use client";

import {
  ArrowRight,
  BookmarkSimple,
  Database,
  Plus,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useId, useMemo, useState } from "react";

import {
  EMPTY_CAREER_PREFERENCES,
  readCareerPreferences,
  subscribeCareerPreferences,
  writeCareerPreferences,
  type CareerPreferences,
} from "@/lib/career-preferences";
import {
  addOwnedSkill,
  clearOwnedSkills,
  readOwnedSkills,
  removeOwnedSkill,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import type { FitAnalyzeResponse } from "@/lib/types";

import {
  buildCareerAnalyzePayload,
  buildCareerSnapshot,
  CAREER_CONDITIONS,
  careerScopeLabel,
  formatDomainLabel,
  type CareerCondition,
  type CareerDomainSuggestion,
  type CareerSnapshot,
} from "./model";
import styles from "./career-overview.module.css";

export type CareerSkillSuggestion = {
  name: string;
  postingCount: number;
};

type CareerOverviewProps = {
  suggestions: CareerSkillSuggestion[];
  suggestionsUnavailable: boolean;
  domainSuggestions?: CareerDomainSuggestion[];
  domainSuggestionsUnavailable?: boolean;
};

type ComparisonState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; snapshot: CareerSnapshot }
  | { status: "error" };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isFitAnalyzeResponse(value: unknown): value is FitAnalyzeResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FitAnalyzeResponse>;
  const coverage = candidate.coverage;

  return Boolean(
    coverage &&
      isCount(coverage.matching_posting_count) &&
      isCount(coverage.strong_fit_posting_count) &&
      coverage.strong_fit_posting_count <= coverage.matching_posting_count &&
      Array.isArray(candidate.recommended_next_skills) &&
      candidate.recommended_next_skills.every(
        (item) =>
          item &&
          typeof item.skill === "string" &&
          typeof item.reason === "string" &&
          isCount(item.required_count) &&
          isCount(item.preferred_count) &&
          isCount(item.supporting_posting_count),
      ) &&
      Array.isArray(candidate.domain_branches) &&
      candidate.domain_branches.every(
        (branch) =>
          branch &&
          typeof branch.domain === "string" &&
          isStringArray(branch.covered_skills) &&
          isStringArray(branch.missing_required_skills) &&
          isStringArray(branch.missing_preferred_skills) &&
          isCount(branch.supporting_posting_count),
      ),
  );
}

function formatCount(value: number, unit: string) {
  return `${value.toLocaleString("ko-KR")}${unit}`;
}

function EvidenceSkills({ skills }: { skills: string[] }) {
  if (skills.length === 0) {
    return <span className={styles.noEvidence}>확인 없음</span>;
  }

  return (
    <ul className={styles.evidenceSkills} role="list">
      {skills.map((skill) => (
        <li key={skill}>{skill}</li>
      ))}
    </ul>
  );
}

function ComparisonResult({ snapshot }: { snapshot: CareerSnapshot }) {
  const hasMatchingPostings = snapshot.metrics.matchingPostingCount > 0;

  return (
    <section aria-labelledby="career-result-title" className={styles.resultPanel}>
      <header className={styles.resultHeader}>
        <div>
          <p>{snapshot.scopeLabel} 조건</p>
          <h2 id="career-result-title">공고 비교 결과</h2>
        </div>
        <span>현재 공개 공고 기준</span>
      </header>

      <dl className={styles.metrics}>
        <div>
          <dt>겹치는 공개 공고</dt>
          <dd className={styles.metricValue}>
            {formatCount(snapshot.metrics.matchingPostingCount, "건")}
          </dd>
          <dd className={styles.metricDescription}>
            보유 기술이 한 개 이상 확인된 공고
          </dd>
        </div>
        <div>
          <dt>필수 기술 절반 이상</dt>
          <dd className={styles.metricValue}>
            {formatCount(snapshot.metrics.strongFitPostingCount, "건")}
          </dd>
          <dd className={styles.metricDescription}>
            명시된 필수 기술의 절반 이상을 보유한 공고
          </dd>
        </div>
        <div>
          <dt>다음 준비 후보</dt>
          <dd className={styles.metricValue}>
            {formatCount(snapshot.metrics.recommendationCount, "개")}
          </dd>
          <dd className={styles.metricDescription}>
            겹치는 공고에서 반복된 부족 요구사항
          </dd>
        </div>
      </dl>

      {!hasMatchingPostings ? (
        <div className={styles.zeroState}>
          <Database aria-hidden="true" size={24} />
          <div>
            <h3>현재 조건에서 겹치는 공고가 없습니다.</h3>
            <p>
              보유 기술을 더 추가하거나 전체 공고에서 다른 조건을 확인해 보세요.
            </p>
          </div>
          <Link className={styles.inlineLink} href="/jobs">
            전체 공고 보기
            <ArrowRight aria-hidden="true" size={16} weight="bold" />
          </Link>
        </div>
      ) : (
        <>
          <section
            aria-labelledby="career-next-skills-title"
            className={styles.resultSection}
          >
            <header className={styles.sectionHeader}>
              <div>
                <p>부족 요구사항</p>
                <h3 id="career-next-skills-title">다음 준비 기술</h3>
              </div>
              <span>최대 6개</span>
            </header>

            {snapshot.recommendations.length === 0 ? (
              <div className={styles.compactState}>
                <h4>반복해서 확인된 다음 기술이 없습니다.</h4>
                <p>현재 보유 기술과 겹치는 공고는 있지만 부족 요구사항이 추출되지 않았습니다.</p>
              </div>
            ) : (
              <ol className={styles.recommendationList} role="list">
                {snapshot.recommendations.map((skill, index) => (
                  <li key={skill.name}>
                    <span className={styles.index} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className={styles.recommendationBody}>
                      <Link
                        aria-label={`${skill.name} 스킬맵 보기`}
                        className={styles.skillLink}
                        href={skill.skillHref}
                      >
                        {skill.name}
                      </Link>
                      <p>
                        부족 요구사항으로 확인된 공개 공고 {formatCount(
                          skill.supportingPostingCount,
                          "건",
                        )}
                      </p>
                    </div>
                    <div className={styles.requirementCounts}>
                      <span>필수 {formatCount(skill.requiredCount, "건")}</span>
                      <span>우대 {formatCount(skill.preferredCount, "건")}</span>
                    </div>
                    <Link
                      aria-label={`${skill.name} 관련 공고 보기`}
                      className={styles.inlineLink}
                      href={skill.jobsHref}
                    >
                      관련 공고
                      <ArrowRight aria-hidden="true" size={15} weight="bold" />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section
            aria-labelledby="career-domain-title"
            className={styles.resultSection}
          >
            <header className={styles.sectionHeader}>
              <div>
                <p>공고 기술 묶음</p>
                <h3 id="career-domain-title">분야별 근거</h3>
              </div>
              <span>근거 공고 순</span>
            </header>

            {snapshot.branches.length === 0 ? (
              <div className={styles.compactState}>
                <h4>분야별 근거가 아직 없습니다.</h4>
                <p>비교 결과에 분야가 확인되면 보유 기술과 부족 기술을 나눠 보여드립니다.</p>
              </div>
            ) : (
              <div className={styles.branchList} role="list">
                {snapshot.branches.map((branch) => (
                  <article className={styles.branch} key={branch.domain} role="listitem">
                    <header>
                      <h4>{branch.label}</h4>
                      <span>근거 공고 {formatCount(branch.supportingPostingCount, "건")}</span>
                    </header>
                    <div className={styles.evidenceGroup}>
                      <h5>보유 기술</h5>
                      <EvidenceSkills skills={branch.coveredSkills} />
                    </div>
                    <div className={styles.evidenceGroup}>
                      <h5>부족 필수</h5>
                      <EvidenceSkills skills={branch.missingRequiredSkills} />
                    </div>
                    <div className={styles.evidenceGroup}>
                      <h5>부족 우대</h5>
                      <EvidenceSkills skills={branch.missingPreferredSkills} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export function CareerOverview({
  suggestions,
  suggestionsUnavailable,
  domainSuggestions = [],
  domainSuggestionsUnavailable = false,
}: CareerOverviewProps) {
  const inputId = useId();
  const inputErrorId = useId();
  const conditionId = useId();
  const targetDomainId = useId();
  const [hydrated, setHydrated] = useState(false);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState("");
  const [careerPreferences, setCareerPreferences] =
    useState<CareerPreferences>(EMPTY_CAREER_PREFERENCES);
  const [preferenceStatus, setPreferenceStatus] = useState("");
  const [comparison, setComparison] = useState<ComparisonState>({ status: "idle" });
  const [retrySequence, setRetrySequence] = useState(0);

  const { careerCondition, targetDomain } = careerPreferences;
  const ownedSkillsSignature = ownedSkills.join("\u0000");
  const availableSuggestions = useMemo(() => {
    const owned = new Set(
      ownedSkills.map((skill) => skill.toLocaleLowerCase("en-US")),
    );
    return suggestions
      .filter(
        (suggestion) =>
          !owned.has(suggestion.name.toLocaleLowerCase("en-US")),
      )
      .slice(0, 8);
  }, [ownedSkills, suggestions]);
  const targetDomainIsAvailable =
    Boolean(targetDomain) &&
    domainSuggestions.some((domain) => domain.value === targetDomain);
  const activeTargetDomain =
    targetDomain &&
    !domainSuggestionsUnavailable &&
    targetDomainIsAvailable
      ? targetDomain
      : "";

  useEffect(() => {
    setOwnedSkills(readOwnedSkills());
    setHydrated(true);
    return subscribeOwnedSkills(setOwnedSkills);
  }, []);

  useEffect(() => {
    setCareerPreferences(readCareerPreferences());
    setPreferencesHydrated(true);
    return subscribeCareerPreferences((nextPreferences) => {
      setCareerPreferences(nextPreferences);
      setPreferenceStatus("");
    });
  }, []);

  useEffect(() => {
    if (
      !preferencesHydrated ||
      domainSuggestionsUnavailable ||
      !targetDomain ||
      targetDomainIsAvailable
    ) {
      return;
    }

    const nextPreferences = writeCareerPreferences({
      careerCondition,
      targetDomain: "",
    });
    setCareerPreferences((current) =>
      current.careerCondition === nextPreferences.careerCondition &&
      current.targetDomain === nextPreferences.targetDomain
        ? current
        : nextPreferences,
    );
    setPreferenceStatus(
      nextPreferences.targetDomain
        ? "현재 목록에 없는 희망 기술 분야를 정리하지 못했습니다."
        : "",
    );
  }, [
    careerCondition,
    domainSuggestionsUnavailable,
    preferencesHydrated,
    targetDomain,
    targetDomainIsAvailable,
  ]);

  useEffect(() => {
    if (!hydrated || !preferencesHydrated || ownedSkills.length === 0) {
      setComparison({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setComparison({ status: "loading" });

    async function requestComparison() {
      try {
        const response = await fetch("/skills/graph/fit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            buildCareerAnalyzePayload(
              ownedSkills,
              careerCondition,
              activeTargetDomain,
            ),
          ),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("comparison request failed");

        const payload: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (!isFitAnalyzeResponse(payload)) {
          throw new Error("invalid comparison response");
        }
        setComparison({
          status: "ready",
          snapshot: buildCareerSnapshot(
            payload,
            careerCondition,
            activeTargetDomain,
          ),
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
        setComparison({ status: "error" });
      }
    }

    void requestComparison();
    return () => controller.abort();
  }, [
    activeTargetDomain,
    careerCondition,
    hydrated,
    ownedSkillsSignature,
    preferencesHydrated,
    retrySequence,
  ]);

  function saveSkill(skill: string) {
    const trimmed = skill.trim();
    if (!trimmed) {
      setInputError("기술 이름을 입력해 주세요.");
      return;
    }
    const normalized =
      suggestions.find(
        (suggestion) =>
          suggestion.name.toLocaleLowerCase("en-US") ===
          trimmed.toLocaleLowerCase("en-US"),
      )?.name ?? trimmed;
    if (
      ownedSkills.some(
        (ownedSkill) =>
          ownedSkill.toLocaleLowerCase("en-US") ===
          normalized.toLocaleLowerCase("en-US"),
      )
    ) {
      setInputError("이미 저장한 기술입니다.");
      return;
    }

    const nextSkills = addOwnedSkill(normalized);
    setOwnedSkills(nextSkills);
    setDraft("");
    setInputError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSkill(draft);
  }

  function handleRemove(skill: string) {
    setOwnedSkills(removeOwnedSkill(skill));
    setInputError("");
  }

  function handleClear() {
    setOwnedSkills(clearOwnedSkills());
    setInputError("");
  }

  function persistCareerPreferences(
    nextPreferences: CareerPreferences,
    failureMessage: string,
  ) {
    const storedPreferences = writeCareerPreferences(nextPreferences);
    setCareerPreferences(storedPreferences);
    const stored =
      storedPreferences.careerCondition === nextPreferences.careerCondition &&
      storedPreferences.targetDomain === nextPreferences.targetDomain;
    setPreferenceStatus(stored ? "" : failureMessage);
  }

  const selectedScopeLabel = careerScopeLabel(
    careerCondition,
    activeTargetDomain,
  );
  const announcement = !hydrated || !preferencesHydrated
    ? "저장한 기술을 확인하고 있습니다."
    : comparison.status === "loading"
      ? `${selectedScopeLabel} 조건의 공개 공고를 비교하고 있습니다.`
      : comparison.status === "error"
        ? "공고 비교를 불러오지 못했습니다."
        : comparison.status === "ready"
          ? `겹치는 공개 공고 ${comparison.snapshot.metrics.matchingPostingCount}건을 확인했습니다.`
          : "보유 기술을 저장하면 공개 공고를 비교합니다.";

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>공식 공고와 내 기술 비교</p>
        <h1>내 커리어</h1>
        <p className={styles.description}>
          직접 저장한 기술과 현재 공개 공고의 확정된 요구사항을 비교해 다음 탐색 근거를 확인하세요.
        </p>
        <div className={styles.introMeta}>
          <span className={styles.privacyBadge}>
            <ShieldCheck aria-hidden="true" size={16} weight="fill" />
            이 브라우저에만 저장
          </span>
          <Link className={styles.savedLibraryLink} href="/career/saved">
            <BookmarkSimple aria-hidden="true" size={16} weight="fill" />
            저장 보관함
          </Link>
        </div>
      </header>

      <div aria-live="polite" className={styles.srOnly}>
        {announcement}
      </div>

      <div className={styles.workspace}>
        <aside
          aria-labelledby="career-owned-skills-title"
          className={styles.stackPanel}
        >
          <header className={styles.panelHeader}>
            <div>
              <p>분석 기준</p>
              <h2 id="career-owned-skills-title">내 기술</h2>
            </div>
            <span>{ownedSkills.length}개</span>
          </header>

          <p className={styles.localNote}>
            로그인이나 서버 저장 없이 이 브라우저에서만 관리합니다.
          </p>

          <form className={styles.skillForm} onSubmit={handleSubmit}>
            <label htmlFor={inputId}>추가할 기술</label>
            <div className={styles.inputRow}>
              <input
                aria-describedby={inputError ? inputErrorId : undefined}
                autoComplete="off"
                id={inputId}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="예: Spring, React"
                type="text"
                value={draft}
              />
              <button className={styles.addButton} type="submit">
                <Plus aria-hidden="true" size={17} weight="bold" />
                기술 추가
              </button>
            </div>
            {inputError && (
              <p className={styles.inputError} id={inputErrorId} role="alert">
                {inputError}
              </p>
            )}
          </form>

          <div className={styles.savedHeader}>
            <h3>저장한 기술</h3>
            {ownedSkills.length > 0 && (
              <button className={styles.clearButton} onClick={handleClear} type="button">
                전체 삭제
              </button>
            )}
          </div>

          {!hydrated ? (
            <p className={styles.stackState}>저장한 기술을 확인하고 있습니다.</p>
          ) : ownedSkills.length === 0 ? (
            <p className={styles.stackState}>아직 저장한 기술이 없습니다.</p>
          ) : (
            <ul aria-label="저장한 기술 목록" className={styles.savedSkills} role="list">
              {ownedSkills.map((skill) => (
                <li key={skill}>
                  <span>{skill}</span>
                  <button
                    aria-label={`${skill} 제거`}
                    onClick={() => handleRemove(skill)}
                    type="button"
                  >
                    <Trash aria-hidden="true" size={17} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <section aria-labelledby="quick-skills-title" className={styles.quickSkills}>
            <header>
              <h3 id="quick-skills-title">빠르게 추가</h3>
              <span>실제 공고 수 기준</span>
            </header>
            {suggestionsUnavailable ? (
              <p className={styles.suggestionState}>
                상위 기술 제안을 불러오지 못했습니다.
              </p>
            ) : suggestions.length === 0 ? (
              <p className={styles.suggestionState}>
                현재 확인된 상위 기술 제안이 없습니다.
              </p>
            ) : availableSuggestions.length === 0 ? (
              <p className={styles.suggestionState}>
                현재 제안 기술을 모두 저장했습니다.
              </p>
            ) : (
              <ul className={styles.suggestionList} role="list">
                {availableSuggestions.map((suggestion) => (
                  <li key={suggestion.name}>
                    <button
                      aria-label={`${suggestion.name} 빠르게 추가, 공개 공고 ${suggestion.postingCount}건`}
                      onClick={() => saveSkill(suggestion.name)}
                      type="button"
                    >
                      <span>{suggestion.name}</span>
                      <small>{formatCount(suggestion.postingCount, "건")}</small>
                      <Plus aria-hidden="true" size={15} weight="bold" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <div className={styles.analysisColumn}>
          <section aria-labelledby="career-condition-title" className={styles.conditionPanel}>
            <div>
              <p>비교 범위</p>
              <h2 id="career-condition-title">비교 조건</h2>
              <span>
                비교 조건은 이 브라우저에 저장되며 현재 공고 비교 요청에만
                사용됩니다. 서버 계정에는 저장되지 않습니다.
              </span>
              {preferenceStatus && (
                <span className={styles.conditionStatus} role="status">
                  {preferenceStatus}
                </span>
              )}
              {domainSuggestionsUnavailable && (
                <span className={styles.conditionStatus} role="status">
                  {targetDomain
                    ? `저장한 희망 분야는 유지하고 현재 요청은 전체 기술 분야로 비교합니다. (${formatDomainLabel(targetDomain)})`
                    : "분야 목록을 불러오지 못해 전체 기술 분야로 비교합니다."}
                </span>
              )}
            </div>
            <div className={styles.conditionControls}>
              <label className={styles.selectLabel} htmlFor={conditionId}>
                <span>경력 조건</span>
                <select
                  disabled={!preferencesHydrated}
                  id={conditionId}
                  onChange={(event) =>
                    persistCareerPreferences(
                      {
                        careerCondition: event.target.value as CareerCondition,
                        targetDomain,
                      },
                      "경력 조건을 저장하지 못했습니다.",
                    )
                  }
                  value={careerCondition}
                >
                  {CAREER_CONDITIONS.map((condition) => (
                    <option key={condition.value || "all"} value={condition.value}>
                      {condition.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.selectLabel} htmlFor={targetDomainId}>
                <span>희망 기술 분야</span>
                <select
                  disabled={!preferencesHydrated}
                  id={targetDomainId}
                  onChange={(event) =>
                    persistCareerPreferences(
                      {
                        careerCondition,
                        targetDomain: event.target.value,
                      },
                      "희망 기술 분야를 저장하지 못했습니다.",
                    )
                  }
                  value={targetDomain}
                >
                  <option value="">전체 기술 분야</option>
                  {targetDomain && !targetDomainIsAvailable && (
                    <option disabled value={targetDomain}>
                      {formatDomainLabel(targetDomain)} · 저장됨, 현재 확인 불가
                    </option>
                  )}
                  {domainSuggestions.map((domain) => (
                    <option key={domain.value} value={domain.value}>
                      {domain.label} · 연결 기술 {formatCount(domain.skillCount, "개")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {!hydrated || !preferencesHydrated ? (
            <section className={styles.messagePanel} role="status">
              <span className={styles.loadingMark} aria-hidden="true" />
              <div>
                <h2>저장한 기술을 확인하고 있습니다.</h2>
                <p>브라우저에 저장된 기술만 읽습니다.</p>
              </div>
            </section>
          ) : ownedSkills.length === 0 ? (
            <section className={styles.messagePanel}>
              <Plus aria-hidden="true" size={24} />
              <div>
                <h2>먼저 보유 기술을 저장해 주세요.</h2>
                <p>왼쪽에서 기술을 직접 입력하거나 실제 공고 기준 제안을 선택할 수 있습니다.</p>
              </div>
              <Link className={styles.inlineLink} href="/skill-map">
                스킬맵 둘러보기
                <ArrowRight aria-hidden="true" size={16} weight="bold" />
              </Link>
            </section>
          ) : comparison.status === "loading" ? (
            <section className={styles.messagePanel} role="status">
              <span className={styles.loadingMark} aria-hidden="true" />
              <div>
                <h2>공고 요구사항을 비교하고 있습니다.</h2>
                <p>{selectedScopeLabel} 조건의 현재 공개 공고를 확인합니다.</p>
              </div>
            </section>
          ) : comparison.status === "error" ? (
            <section className={styles.errorPanel} role="alert">
              <div>
                <h2>공고 비교를 불러오지 못했습니다.</h2>
                <p>저장한 기술은 그대로 유지됩니다. 잠시 후 다시 시도해 주세요.</p>
              </div>
              <button
                className={styles.retryButton}
                onClick={() => setRetrySequence((current) => current + 1)}
                type="button"
              >
                다시 시도
              </button>
            </section>
          ) : comparison.status === "ready" ? (
            <ComparisonResult snapshot={comparison.snapshot} />
          ) : null}

          <section aria-labelledby="career-method-title" className={styles.methodPanel}>
            <div>
              <p>해석 기준</p>
              <h2 id="career-method-title">숫자를 읽는 방법</h2>
            </div>
            <p>
              희망 기술 분야는 현재 스킬 그래프가 제공하는 분야 메타데이터로 비교
              범위를 좁힙니다. {" "}
              공식 채용페이지에서 현재 공개 상태로 확인된 공고와 확정 기술 추출만 비교합니다.
              이 결과는 합격 여부, 장기 전망 또는 학습 순서를 예측하지 않습니다.
            </p>
            <nav aria-label="커리어 분석 관련 페이지" className={styles.methodLinks}>
              <Link href="/methodology">분석 방법</Link>
              <Link href="/skill-map">스킬맵</Link>
              <Link href="/jobs">공개 공고</Link>
            </nav>
          </section>
        </div>
      </div>
    </main>
  );
}
