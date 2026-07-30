"use client";

import {
  CaretDown,
  CheckCircle,
  IdentificationCard,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useEffect, useId, useState } from "react";

import {
  careerAnalysisLevel,
  EMPTY_CAREER_PROFILE,
  normalizeCareerProfile,
  readCareerProfile,
  subscribeCareerProfile,
  writeCareerProfile,
  type CareerEmploymentType,
  type CareerExperienceHighlight,
  type CareerProfile,
  type CareerWorkType,
  type SkillLastUsed,
} from "@/lib/career-profile";

import type { CareerDomainSuggestion } from "./model";
import styles from "./career-profile-editor.module.css";

type CareerProfileEditorProps = {
  domains: CareerDomainSuggestion[];
  ownedSkills: string[];
};

const WORK_TYPE_OPTIONS: ReadonlyArray<{
  label: string;
  value: CareerWorkType;
}> = [
  { label: "개발", value: "development" },
  { label: "운영", value: "operations" },
  { label: "분석", value: "analysis" },
  { label: "자동화", value: "automation" },
  { label: "기획", value: "planning" },
  { label: "리더십", value: "leadership" },
];

const EMPLOYMENT_OPTIONS: ReadonlyArray<{
  label: string;
  value: CareerEmploymentType;
}> = [
  { label: "정규직", value: "full_time" },
  { label: "계약직", value: "contract" },
  { label: "프리랜서", value: "freelance" },
  { label: "인턴", value: "intern" },
];

const EMPTY_HIGHLIGHT: CareerExperienceHighlight = {
  title: "",
  responsibilities: "",
  outcome: "",
  domain: "",
  skills: [],
};

function commaList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toggleListValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function CareerProfileEditor({
  domains,
  ownedSkills,
}: CareerProfileEditorProps) {
  const [profile, setProfile] = useState<CareerProfile>(EMPTY_CAREER_PROFILE);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [status, setStatus] = useState<"" | "saved" | "error">("");
  const advancedId = useId();

  useEffect(() => {
    setProfile(readCareerProfile());
    return subscribeCareerProfile((nextProfile) => {
      setProfile(nextProfile);
    });
  }, []);

  function update<K extends keyof CareerProfile>(
    key: K,
    value: CareerProfile[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
    setStatus("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeCareerProfile(profile);
    const stored = writeCareerProfile(normalized);
    setProfile(stored);
    setStatus(
      JSON.stringify(stored) === JSON.stringify(normalized)
        ? "saved"
        : "error",
    );
  }

  function updateHighlight(
    index: number,
    next: Partial<CareerExperienceHighlight>,
  ) {
    update(
      "experienceHighlights",
      profile.experienceHighlights.map((highlight, currentIndex) =>
        currentIndex === index ? { ...highlight, ...next } : highlight,
      ),
    );
  }

  return (
    <section aria-labelledby="career-profile-title" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p>최소 입력</p>
          <h2 id="career-profile-title">현재 경력</h2>
          <span>
            최소 정보로 시작할 수 있습니다. 업무와 선호 조건을 더할수록 경력 기준으로
            연결 근거를 보여드립니다.
          </span>
        </div>
        <span className={styles.analysisLevel}>
          <IdentificationCard aria-hidden="true" size={17} weight="duotone" />
          {careerAnalysisLevel(profile)}
        </span>
      </header>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.minimumGrid}>
          <label>
            <span>현재 직무</span>
            <input
              autoComplete="organization-title"
              maxLength={120}
              onChange={(event) => update("currentRole", event.target.value)}
              placeholder="예: 백엔드 개발자"
              type="text"
              value={profile.currentRole}
            />
          </label>
          <label>
            <span>경력 기간</span>
            <div className={styles.numberInput}>
              <input
                aria-label="경력 기간"
                inputMode="decimal"
                max="60"
                min="0"
                onChange={(event) =>
                  update(
                    "experienceYears",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
                step="0.5"
                type="number"
                value={profile.experienceYears ?? ""}
              />
              <span>년</span>
            </div>
          </label>
          <label className={styles.wideField}>
            <span>주요 업무와 책임</span>
            <textarea
              maxLength={1200}
              onChange={(event) => update("responsibilities", event.target.value)}
              placeholder="예: 결제 API 개발, 장애 대응, 배포 자동화를 담당했습니다."
              rows={3}
              value={profile.responsibilities}
            />
          </label>
        </div>

        <button
          aria-controls={advancedId}
          aria-expanded={advancedOpen}
          className={styles.disclosure}
          onClick={() => setAdvancedOpen((open) => !open)}
          type="button"
        >
          <span>{advancedOpen ? "추가 정보 접기" : "경력 정보 더 추가"}</span>
          <CaretDown
            aria-hidden="true"
            data-open={advancedOpen ? "true" : undefined}
            size={18}
          />
        </button>

        {advancedOpen && (
          <div className={styles.advanced} id={advancedId}>
            <div className={styles.advancedGrid}>
              <label>
                <span>과거 직무</span>
                <input
                  onChange={(event) => update("pastRoles", commaList(event.target.value))}
                  placeholder="쉼표로 구분"
                  type="text"
                  value={profile.pastRoles.join(", ")}
                />
              </label>
              <label>
                <span>산업 및 도메인 경험</span>
                <input
                  onChange={(event) =>
                    update("industryExperience", commaList(event.target.value))
                  }
                  placeholder="예: 핀테크, 커머스"
                  type="text"
                  value={profile.industryExperience.join(", ")}
                />
              </label>
              <label>
                <span>현재 분야</span>
                <select
                  onChange={(event) => update("currentDomain", event.target.value)}
                  value={profile.currentDomain}
                >
                  <option value="">선택하지 않음</option>
                  {domains.map((domain) => (
                    <option key={domain.value} value={domain.value}>
                      {domain.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>경력 수준</span>
                <select
                  onChange={(event) =>
                    update("careerLevel", event.target.value as CareerProfile["careerLevel"])
                  }
                  value={profile.careerLevel}
                >
                  <option value="">선택하지 않음</option>
                  <option value="new_comer">신입</option>
                  <option value="experienced">경력</option>
                  <option value="junior">주니어</option>
                  <option value="mid">중간 경력</option>
                  <option value="senior">시니어</option>
                  <option value="lead">리드</option>
                </select>
              </label>
            </div>

            <fieldset className={styles.highlights}>
              <legend>프로젝트·성과 경험</legend>
              <p>
                공고의 주요 업무와 비교할 경험을 항목별로 입력해 주세요. 수치 성과가
                없다면 맡은 역할과 결과만 적어도 됩니다.
              </p>
              <div className={styles.highlightList}>
                {profile.experienceHighlights.map((highlight, index) => (
                  <section
                    aria-label={"프로젝트·성과 경험 " + (index + 1)}
                    className={styles.highlightItem}
                    key={"highlight-" + index}
                  >
                    <div className={styles.highlightHeading}>
                      <strong>경험 {index + 1}</strong>
                      <button
                        aria-label={"프로젝트·성과 경험 " + (index + 1) + " 삭제"}
                        onClick={() =>
                          update(
                            "experienceHighlights",
                            profile.experienceHighlights.filter(
                              (_, currentIndex) => currentIndex !== index,
                            ),
                          )
                        }
                        type="button"
                      >
                        <Trash aria-hidden="true" size={16} />
                        삭제
                      </button>
                    </div>
                    <div className={styles.highlightGrid}>
                      <label>
                        <span>프로젝트 또는 성과명</span>
                        <input
                          maxLength={120}
                          onChange={(event) =>
                            updateHighlight(index, { title: event.target.value })
                          }
                          placeholder="예: 결제 API 안정화"
                          type="text"
                          value={highlight.title}
                        />
                      </label>
                      <label>
                        <span>관련 분야</span>
                        <select
                          onChange={(event) =>
                            updateHighlight(index, { domain: event.target.value })
                          }
                          value={highlight.domain}
                        >
                          <option value="">선택하지 않음</option>
                          {domains.map((domain) => (
                            <option key={domain.value} value={domain.value}>
                              {domain.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.wideField}>
                        <span>맡은 역할과 업무</span>
                        <textarea
                          maxLength={1200}
                          onChange={(event) =>
                            updateHighlight(index, {
                              responsibilities: event.target.value,
                            })
                          }
                          placeholder="예: 장애 원인 분석, 배포 자동화, 운영 절차 개선"
                          rows={2}
                          value={highlight.responsibilities}
                        />
                      </label>
                      <label className={styles.wideField}>
                        <span>결과 또는 변화</span>
                        <textarea
                          maxLength={1200}
                          onChange={(event) =>
                            updateHighlight(index, { outcome: event.target.value })
                          }
                          placeholder="예: 반복 장애 대응 절차를 표준화했습니다."
                          rows={2}
                          value={highlight.outcome}
                        />
                      </label>
                      <label className={styles.wideField}>
                        <span>사용 기술</span>
                        <input
                          onChange={(event) =>
                            updateHighlight(index, {
                              skills: commaList(event.target.value),
                            })
                          }
                          placeholder="쉼표로 구분: Python, Kubernetes"
                          type="text"
                          value={highlight.skills.join(", ")}
                        />
                      </label>
                    </div>
                  </section>
                ))}
              </div>
              <button
                className={styles.addHighlight}
                disabled={profile.experienceHighlights.length >= 8}
                onClick={() =>
                  update("experienceHighlights", [
                    ...profile.experienceHighlights,
                    { ...EMPTY_HIGHLIGHT, skills: [] },
                  ])
                }
                type="button"
              >
                <Plus aria-hidden="true" size={16} />
                프로젝트·성과 경험 추가
              </button>
            </fieldset>

            <fieldset className={styles.choiceGroup}>
              <legend>주요 업무 유형</legend>
              <div>
                {WORK_TYPE_OPTIONS.map((option) => (
                  <label key={option.value}>
                    <input
                      checked={profile.workTypes.includes(option.value)}
                      onChange={() =>
                        update(
                          "workTypes",
                          toggleListValue(profile.workTypes, option.value),
                        )
                      }
                      type="checkbox"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {domains.length > 0 && (
              <div className={styles.domainGroups}>
                <fieldset className={styles.choiceGroup}>
                  <legend>관심 분야</legend>
                  <div>
                    {domains.map((domain) => (
                      <label key={domain.value}>
                        <input
                          checked={profile.interestDomains.includes(domain.value)}
                          onChange={() => {
                            update(
                              "interestDomains",
                              toggleListValue(profile.interestDomains, domain.value),
                            );
                          }}
                          type="checkbox"
                        />
                        <span>{domain.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className={styles.choiceGroup}>
                  <legend>제외하고 싶은 분야</legend>
                  <div>
                    {domains.map((domain) => (
                      <label key={domain.value}>
                        <input
                          checked={profile.excludedDomains.includes(domain.value)}
                          onChange={() =>
                            update(
                              "excludedDomains",
                              toggleListValue(profile.excludedDomains, domain.value),
                            )
                          }
                          type="checkbox"
                        />
                        <span>{domain.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            <div className={styles.advancedGrid}>
              <label className={styles.wideField}>
                <span>앞으로도 유지하고 싶은 경험</span>
                <textarea
                  maxLength={1200}
                  onChange={(event) => update("keepExperience", event.target.value)}
                  placeholder="예: 대규모 트래픽 서비스 운영 경험"
                  rows={2}
                  value={profile.keepExperience}
                />
              </label>
              <label>
                <span>희망 지역</span>
                <input
                  onChange={(event) =>
                    update("preferredLocations", commaList(event.target.value))
                  }
                  placeholder="예: 서울, 경기"
                  type="text"
                  value={profile.preferredLocations.join(", ")}
                />
              </label>
            </div>

            <fieldset className={styles.choiceGroup}>
              <legend>고용 형태</legend>
              <div>
                {EMPLOYMENT_OPTIONS.map((option) => (
                  <label key={option.value}>
                    <input
                      checked={profile.employmentTypes.includes(option.value)}
                      onChange={() =>
                        update(
                          "employmentTypes",
                          toggleListValue(profile.employmentTypes, option.value),
                        )
                      }
                      type="checkbox"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {ownedSkills.length > 0 && (
              <fieldset className={styles.skillUsage}>
                <legend>기술별 사용 경험</legend>
                <p>사용 기간과 최근 사용 시점은 공고 조건을 해석하는 보조 근거입니다.</p>
                <div>
                  {ownedSkills.map((skill) => {
                    const usage = profile.skillUsage[skill] ?? {
                      years: null,
                      lastUsed: "" as SkillLastUsed,
                    };
                    return (
                      <section aria-label={`${skill} 사용 경험`} key={skill}>
                        <strong>{skill}</strong>
                        <label>
                          <span>{skill} 사용 기간</span>
                          <div className={styles.numberInput}>
                            <input
                              aria-label={`${skill} 사용 기간`}
                              inputMode="decimal"
                              max="60"
                              min="0"
                              onChange={(event) =>
                                update("skillUsage", {
                                  ...profile.skillUsage,
                                  [skill]: {
                                    ...usage,
                                    years:
                                      event.target.value === ""
                                        ? null
                                        : Number(event.target.value),
                                  },
                                })
                              }
                              step="0.5"
                              type="number"
                              value={usage.years ?? ""}
                            />
                            <span>년</span>
                          </div>
                        </label>
                        <label>
                          <span>{skill} 최근 사용 시점</span>
                          <select
                            aria-label={`${skill} 최근 사용 시점`}
                            onChange={(event) =>
                              update("skillUsage", {
                                ...profile.skillUsage,
                                [skill]: {
                                  ...usage,
                                  lastUsed: event.target.value as SkillLastUsed,
                                },
                              })
                            }
                            value={usage.lastUsed}
                          >
                            <option value="">선택하지 않음</option>
                            <option value="current">현재 사용 중</option>
                            <option value="within_1y">최근 1년 이내 사용</option>
                            <option value="over_1y">1년 이전에 사용</option>
                          </select>
                        </label>
                      </section>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>
        )}

        <footer className={styles.footer}>
          <p>
            입력한 정보는 이 브라우저에 저장되며, 로그인하면 계정과 동기화됩니다.
          </p>
          <button type="submit">커리어 프로필 저장</button>
        </footer>
        {status && (
          <p className={styles.status} role="status">
            <CheckCircle aria-hidden="true" size={17} weight="fill" />
            {status === "saved" ? (
              <span>
                <strong>프로필 저장 완료</strong>
                홈, 커리어맵, 추천 채용공고가 새 정보로 다시 계산됩니다.
              </span>
            ) : (
              <span>
                <strong>일부 정보를 저장하지 못했습니다.</strong>
                기존에 저장된 프로필은 유지됩니다.
              </span>
            )}
          </p>
        )}
      </form>
    </section>
  );
}
