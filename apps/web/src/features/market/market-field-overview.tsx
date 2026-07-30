"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { MarketField, MarketOverviewSnapshot } from "./model";
import styles from "./market-field-overview.module.css";

type MarketFieldOverviewProps = {
  fields: MarketField[];
  initialField: string;
  scope: MarketOverviewSnapshot["fieldScope"];
  error?: string | null;
  retryHref?: string;
};

function formatVerifiedDate(value: string) {
  if (Number.isNaN(Date.parse(value))) return "확인 시점 미기재";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function FieldFacts({ field }: { field: MarketField }) {
  return (
    <dl className={styles.facts}>
      <div>
        <dt>공고 수</dt>
        <dd>{field.postingCount.toLocaleString("ko-KR")}건</dd>
      </div>
      <div>
        <dt>기업 수</dt>
        <dd>{field.companyCount.toLocaleString("ko-KR")}곳</dd>
      </div>
      <div>
        <dt>신입</dt>
        <dd>{field.careerCounts.newComer.toLocaleString("ko-KR")}건</dd>
      </div>
      <div>
        <dt>경력</dt>
        <dd>{field.careerCounts.experienced.toLocaleString("ko-KR")}건</dd>
      </div>
      <div>
        <dt>신입·경력 또는 미기재</dt>
        <dd>{field.careerCounts.mixedOrUnknown.toLocaleString("ko-KR")}건</dd>
      </div>
    </dl>
  );
}

export function MarketFieldOverview({
  fields,
  initialField,
  scope,
  error = null,
  retryHref = "/market",
}: MarketFieldOverviewProps) {
  const firstField = fields[0]?.domain ?? "";
  const [selectedDomain, setSelectedDomain] = useState(
    fields.some((field) => field.domain === initialField)
      ? initialField
      : firstField,
  );
  const [comparisonDomain, setComparisonDomain] = useState("");
  const selected = useMemo(
    () => fields.find((field) => field.domain === selectedDomain) ?? fields[0],
    [fields, selectedDomain],
  );
  const comparison = fields.find(
    (field) => field.domain === comparisonDomain && field.domain !== selected?.domain,
  );

  return (
    <section
      aria-labelledby="market-field-heading"
      className={styles.section}
    >
      <header className={styles.header}>
        <div>
          <h2 id="market-field-heading">분야별 채용 현황</h2>
          <p>
            공고 제목과 주요 업무, 확인된 기술 조건으로 분야를 분류했습니다. 공고 수와
            서로 다른 기업 수를 함께 확인할 수 있습니다.
          </p>
        </div>
        <Link className={styles.primaryLink} href="/jobs">
          채용공고 직접 찾기
        </Link>
      </header>

      {error ? (
        <div className={styles.state} role="alert">
          <strong>분야별 채용 현황을 불러오지 못했습니다.</strong>
          <p>{error} 이 상태는 공고가 0건이라는 뜻이 아닙니다.</p>
          <Link href={retryHref}>분야별 현황 다시 불러오기</Link>
        </div>
      ) : fields.length === 0 || !selected ? (
        <div className={styles.state}>
          <strong>현재 조건에서 확인된 커리어 분야가 없습니다.</strong>
          <p>경력 조건을 해제하거나 전체 채용공고에서 직접 찾아보세요.</p>
          <Link href="/market">전체 조건으로 다시 보기</Link>
        </div>
      ) : (
        <>
          <div aria-label="커리어 분야 선택" className={styles.fieldTabs} role="group">
            {fields.map((field) => (
              <button
                aria-pressed={selected.domain === field.domain}
                key={field.domain}
                onClick={() => {
                  setSelectedDomain(field.domain);
                  if (comparisonDomain === field.domain) setComparisonDomain("");
                }}
                type="button"
                aria-label={`${field.label} 분야 보기`}
              >
                <span>{field.label}</span>
                <small>
                  공고 {field.postingCount.toLocaleString("ko-KR")}건 · 기업{" "}
                  {field.companyCount.toLocaleString("ko-KR")}곳
                </small>
              </button>
            ))}
          </div>

          <article className={styles.fieldDetail}>
            <div className={styles.fieldSummary}>
              <div>
                <p className={styles.selectionLabel}>선택한 분야</p>
                <h3>{selected.label}</h3>
              </div>
              <FieldFacts field={selected} />
            </div>

            <div className={styles.detailGrid}>
              <section>
                <h4>공고에서 자주 확인된 기술</h4>
                {selected.topSkills.length > 0 ? (
                  <ul className={styles.chips}>
                    {selected.topSkills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p>기술 조건이 확인된 공고가 아직 없습니다.</p>
                )}
              </section>
              <section>
                <h4>주요 근무지</h4>
                {selected.topLocations.length > 0 ? (
                  <p>{selected.topLocations.join(" · ")}</p>
                ) : (
                  <p>채용공고 내용에서 근무지를 확인할 수 없습니다.</p>
                )}
              </section>
            </div>

            <section className={styles.jobs}>
              <div className={styles.subheading}>
                <h4>최근 확인한 관련 채용공고</h4>
                <Link href="/jobs">전체 채용공고 보기</Link>
              </div>
              {selected.jobs.length > 0 ? (
                <ul>
                  {selected.jobs.map((job) => (
                    <li key={job.id}>
                      <Link href={job.href}>
                        <strong>{job.title}</strong>
                        <span>{job.companyName}</span>
                        <small>
                          {job.careerLabel} · {job.location} · 최근 확인{" "}
                          {formatVerifiedDate(job.verifiedAt)}
                        </small>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>목록에서 바로 연결할 수 있는 공개 채용공고가 없습니다.</p>
              )}
            </section>
          </article>

          {fields.length > 1 ? (
            <section aria-label="커리어 분야 비교" className={styles.comparison}>
              <div className={styles.comparisonHeader}>
                <div>
                  <h3>분야 비교</h3>
                  <p>공고 규모와 경력 조건, 자주 확인된 기술을 나란히 봅니다.</p>
                </div>
                <label>
                  <span>비교할 분야</span>
                  <select
                    aria-label="비교할 분야"
                    onChange={(event) => setComparisonDomain(event.target.value)}
                    value={comparisonDomain}
                  >
                    <option value="">분야 선택</option>
                    {fields
                      .filter((field) => field.domain !== selected.domain)
                      .map((field) => (
                        <option key={field.domain} value={field.domain}>
                          {field.label}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              {comparison ? (
                <div className={styles.comparisonGrid}>
                  {[selected, comparison].map((field) => (
                    <article key={field.domain}>
                      <h4>{field.label}</h4>
                      <FieldFacts field={field} />
                      <p>
                        주요 기술: {field.topSkills.join(", ") || "확인되지 않음"}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.comparisonEmpty}>
                  비교할 분야를 선택하면 같은 기준으로 차이를 보여드립니다.
                </p>
              )}
            </section>
          ) : null}
        </>
      )}

      {!error && (
        <p className={styles.scopeNote}>
          분야 분류 근거가 확인된 공개 채용공고{" "}
          {scope.evidencePostingCount.toLocaleString("ko-KR")}건을 집계했습니다. 기술
          관계 보조 표본은 최대 {scope.graphLimit ?? 0}개 기술을 확인하며, 같은 공고의
          동시 등장은 인과관계나 학습 순서를 뜻하지 않습니다. 수집된 공개 공고
          기준이므로 전체 채용시장을 대표하지 않습니다.
        </p>
      )}
    </section>
  );
}
