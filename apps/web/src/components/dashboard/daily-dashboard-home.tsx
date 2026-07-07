"use client";

import {
  Bell,
  MagnifyingGlass,
  SlidersHorizontal,
  UserCircle,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { DashboardShell } from "./app-shell";
import { DailySummaryStrip } from "./daily-summary-strip";
import { FitJobRow } from "./fit-job-row";
import { JobInspectorPanel } from "./job-inspector-panel";
import { MiniMarketSignals } from "./mini-market-signals";
import type { DailyDashboardModel } from "./types";


type DailyDashboardHomeProps = {
  model: DailyDashboardModel;
  dataFailed: boolean;
};


function modeMessage(mode: DailyDashboardModel["mode"]) {
  if (mode === "personalized") {
    return "내 스택과 연결된 최근 맞춤 공고입니다.";
  }
  if (mode === "supplemented") {
    return "맞춤 공고가 아직 적어서 전체 신규 공고를 함께 보여줍니다.";
  }
  return "내 스택을 입력하면 맞춤 공고가 정렬됩니다.";
}


export function DailyDashboardHome({ model, dataFailed }: DailyDashboardHomeProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const visibleOwnedSkills = model.ownedSkills.slice(0, 5);
  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return model.jobs;
    }

    return model.jobs.filter((job) =>
      [
        job.companyName,
        job.title,
        job.location,
        job.careerLabel,
        ...job.matchedSkills,
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [model.jobs, query]);
  const selectedJob = useMemo(
    () => model.jobs.find((job) => job.id === selectedJobId) ?? null,
    [model.jobs, selectedJobId],
  );

  return (
    <DashboardShell>
      <main className="daily-main">
        <header className="daily-topbar">
          <div className="daily-welcome">
            <span>오늘의 채용 브리핑</span>
            <h1>기술 채용 인텔리전스</h1>
            <p>최근 공고와 내 스택 기준 신호만 빠르게 확인하세요.</p>
          </div>
          <label className="daily-search" htmlFor="daily-search">
            <span>통합 검색</span>
            <i aria-hidden="true">
              <MagnifyingGlass size={16} weight="light" />
            </i>
            <input
              id="daily-search"
              type="search"
              placeholder="기술, 직무, 기업"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="daily-top-actions" aria-label="대시보드 필터와 계정">
            <button className="daily-filter-button" type="button">
              <SlidersHorizontal size={15} weight="bold" aria-hidden />
              지역 전체
            </button>
            <button className="daily-filter-button" type="button">경력 전체</button>
            <button className="daily-icon-button" type="button" aria-label="알림">
              <Bell size={18} weight="regular" aria-hidden />
            </button>
            <span className="daily-user-pill">
              <UserCircle size={20} weight="duotone" aria-hidden />
              김민준
            </span>
          </div>
          <div className="daily-stack-row" aria-label="현재 기준 스택">
            <span>내 기술스택</span>
            {visibleOwnedSkills.map((skill) => (
              <b key={skill}>{skill}</b>
            ))}
            {model.ownedSkills.length > visibleOwnedSkills.length && (
              <b>+{model.ownedSkills.length - visibleOwnedSkills.length}</b>
            )}
          </div>
        </header>

        {dataFailed && (
          <div className="daily-alert" role="alert">
            API 응답이 불안정해 일부 데이터가 비어 있을 수 있습니다.
          </div>
        )}

        <DailySummaryStrip summary={model.summary} />

        <section className="daily-content-grid">
          <section className="recent-fit-panel" id="jobs" aria-labelledby="recent-fit-title">
            <div className="daily-card-core recent-fit-panel__core">
              <header className="recent-fit-panel__header">
                <div>
                  <span>최근 맞춤 공고</span>
                  <h2 id="recent-fit-title">최근 맞춤 공고</h2>
                  <p>{modeMessage(model.mode)}</p>
                </div>
                <strong>{filteredJobs.length}개</strong>
              </header>

              {filteredJobs.length > 0 ? (
                <ul className="fit-job-list" aria-label="최근 맞춤 공고 목록">
                  {filteredJobs.map((job) => (
                    <FitJobRow
                      job={job}
                      key={job.id}
                      selected={selectedJobId === job.id}
                      onSelect={setSelectedJobId}
                    />
                  ))}
                </ul>
              ) : (
                <div className="daily-empty" role="status">
                  <h3>{query ? "검색 결과가 없습니다." : "표시할 공고가 없습니다."}</h3>
                  <p>
                    {query
                      ? "다른 기술, 직무, 기업명으로 다시 검색해보세요."
                      : "내 스택을 입력하거나 수집 데이터가 쌓이면 맞춤 공고가 표시됩니다."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <JobInspectorPanel selectedJob={selectedJob} jobs={model.jobs} />
        </section>

        <MiniMarketSignals
          trendingSkills={model.trendingSkills}
          cooccurringSkills={model.cooccurringSkills}
        />
      </main>
    </DashboardShell>
  );
}
