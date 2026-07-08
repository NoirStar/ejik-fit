"use client";

import {
  ArrowUp,
  ArrowUpRight,
  Bell,
  Briefcase,
  CaretDown,
  Clock,
  FunnelSimple,
  Info,
  MagnifyingGlass,
  MapPin,
  TrendUp,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "./app-shell";
import {
  dashboardFiltersToHref,
  DEFAULT_DASHBOARD_FILTERS,
  filterJobRows,
  type DashboardFilters,
  type FilterableJobRow,
} from "./dashboard-filters";
import type { DailyDashboardModel, DashboardJob, MarketSignal } from "./types";
import {
  normalizeOwnedSkills,
  ownedSkillsToDashboardHref,
  readOwnedSkills,
  writeOwnedSkills,
} from "@/lib/owned-skills";


type DailyDashboardHomeProps = {
  model: DailyDashboardModel;
  dataFailed: boolean;
  initialFilters?: DashboardFilters;
};


type WeeklyJobRow = FilterableJobRow & {
  tone: string;
};


type DeadlineRow = FilterableJobRow & {
  badge: string;
  date: string;
  tone: string;
};


const SAMPLE_WEEKLY_JOBS: WeeklyJobRow[] = [
  {
    companyName: "네이버",
    title: "백엔드 개발자 (Java/Spring)",
    location: "경기 성남",
    time: "2시간 전",
    careerLabel: "경력",
    skills: ["Java", "Spring"],
    tone: "green",
  },
  {
    companyName: "카카오",
    title: "Backend Engineer (Spring)",
    location: "경기 성남",
    time: "4시간 전",
    careerLabel: "경력",
    skills: ["Spring"],
    tone: "yellow",
  },
  {
    companyName: "우아한형제들",
    title: "백엔드 개발자 (Java/AWS)",
    location: "서울 송파",
    time: "6시간 전",
    careerLabel: "경력",
    skills: ["Java", "AWS"],
    tone: "cyan",
  },
  {
    companyName: "토스",
    title: "백엔드 엔지니어 (Kotlin/Java)",
    location: "서울 강남",
    time: "8시간 전",
    careerLabel: "경력",
    skills: ["Kotlin", "Java"],
    tone: "blue",
  },
  {
    companyName: "당근",
    title: "서버 개발자 (Java/Kubernetes)",
    location: "서울 서초",
    time: "11시간 전",
    careerLabel: "경력",
    skills: ["Java", "Kubernetes"],
    tone: "red",
  },
];


const SAMPLE_DEADLINE_JOBS: DeadlineRow[] = [
  {
    companyName: "삼성SDS",
    title: "클라우드 개발자 (AWS)",
    location: "서울 강남",
    time: "D-2",
    careerLabel: "경력",
    skills: ["AWS"],
    badge: "D-2",
    date: "5/17 (금)",
    tone: "blue",
  },
  {
    companyName: "라인플러스",
    title: "백엔드 개발자 (Kotlin)",
    location: "경기 성남",
    time: "D-3",
    careerLabel: "경력",
    skills: ["Kotlin"],
    badge: "D-3",
    date: "5/18 (토)",
    tone: "green",
  },
  {
    companyName: "LG CNS",
    title: "DevOps 엔지니어 (AWS)",
    location: "서울 마곡",
    time: "D-4",
    careerLabel: "경력",
    skills: ["AWS", "DevOps"],
    badge: "D-4",
    date: "5/19 (일)",
    tone: "red",
  },
  {
    companyName: "야놀자",
    title: "백엔드 개발자 (Java)",
    location: "서울 강남",
    time: "5/14 변경",
    careerLabel: "경력",
    skills: ["Java"],
    badge: "변경됨",
    date: "5/14 (화) 변경",
    tone: "pink",
  },
  {
    companyName: "컬리",
    title: "SRE 엔지니어 (Kubernetes)",
    location: "서울 송파",
    time: "5/13 변경",
    careerLabel: "경력",
    skills: ["Kubernetes", "SRE"],
    badge: "변경됨",
    date: "5/13 (월) 변경",
    tone: "purple",
  },
];


const FALLBACK_TRENDS = [
  { label: "Kubernetes", value: "28.3%" },
  { label: "Kafka", value: "21.7%" },
  { label: "Terraform", value: "18.9%" },
  { label: "Prometheus", value: "15.2%" },
  { label: "Go", value: "13.8%" },
];


const CHART_DATES = ["4/15", "4/21", "4/27", "5/3", "5/9", "5/15"];
const REGION_OPTIONS = [
  { value: "all", label: "지역 전체", icon: MapPin },
  { value: "seoul", label: "서울" },
  { value: "gyeonggi", label: "경기" },
  { value: "remote", label: "원격" },
] as const;
const CAREER_OPTIONS = [
  { value: "all", label: "경력 전체", icon: Briefcase },
  { value: "experienced", label: "경력" },
  { value: "newcomer", label: "신입" },
  { value: "any", label: "무관" },
] as const;
const PERIOD_OPTIONS = [
  { value: "all", label: "기간 전체", icon: FunnelSimple },
  { value: "today", label: "오늘" },
  { value: "week", label: "7일" },
  { value: "deadline", label: "마감" },
] as const;


function buildWeeklyJobs(jobs: DashboardJob[]): WeeklyJobRow[] {
  const mappedJobs = jobs.slice(0, 5).map((job, index) => ({
    companyName: job.companyName,
    title: job.title,
    location: job.location,
    time: job.freshnessLabel,
    careerLabel: job.careerLabel,
    skills: [...job.matchedSkills, ...job.missingSkills],
    tone: SAMPLE_WEEKLY_JOBS[index]?.tone ?? "blue",
  }));

  return [...mappedJobs, ...SAMPLE_WEEKLY_JOBS].slice(0, 5);
}


function buildTrendRows(signals: MarketSignal[]) {
  const signalRows = signals.slice(0, 5).map((signal, index) => ({
    label: signal.label,
    value: FALLBACK_TRENDS[index]?.value ?? signal.value.replace("건", ".0%"),
  }));

  const seen = new Set(signalRows.map((row) => row.label.toLowerCase()));
  const fallbackRows = FALLBACK_TRENDS.filter(
    (row) => !seen.has(row.label.toLowerCase()),
  );

  return [...signalRows, ...fallbackRows].slice(0, 5);
}


function CompanyMark({
  companyName,
  tone,
}: {
  companyName: string;
  tone: string;
}) {
  return (
    <span className={`reference-company-mark reference-company-mark--${tone}`}>
      {companyName.slice(0, 1)}
    </span>
  );
}


function Sparkline() {
  return (
    <svg className="reference-sparkline" viewBox="0 0 130 54" aria-hidden="true">
      <polyline
        fill="none"
        points="2,42 14,28 25,39 37,20 49,18 61,26 73,12 85,9 97,18 109,6 126,3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}


function WeeklyChart() {
  return (
    <div className="reference-chart-wrap">
      <svg
        className="reference-market-chart"
        role="img"
        aria-label="내 기술스택 기준 시장 변화 그래프"
        viewBox="0 0 720 260"
      >
        {[0, 1, 2, 3, 4].map((line) => (
          <line
            className="reference-chart-grid"
            key={line}
            x1="42"
            x2="690"
            y1={42 + line * 42}
            y2={42 + line * 42}
          />
        ))}
        <polyline
          className="reference-chart-line reference-chart-line--market"
          fill="none"
          points="42,154 92,132 138,128 184,106 230,112 276,88 322,104 368,92 414,86 460,96 506,88 552,72 598,74 644,58 690,28"
        />
        <polyline
          className="reference-chart-line reference-chart-line--owned"
          fill="none"
          points="42,190 92,166 138,162 184,146 230,150 276,132 322,138 368,126 414,122 460,132 506,122 552,108 598,104 644,96 690,70"
        />
        <polyline
          className="reference-chart-line reference-chart-line--jobs"
          fill="none"
          points="42,226 92,206 138,202 184,184 230,190 276,176 322,180 368,170 414,172 460,178 506,164 552,160 598,150 644,144 690,120"
        />
      </svg>
      <div className="reference-chart-axis reference-chart-axis--y">
        <span>120</span>
        <span>90</span>
        <span>60</span>
        <span>30</span>
        <span>0</span>
      </div>
      <div className="reference-chart-axis reference-chart-axis--x">
        {CHART_DATES.map((date) => (
          <span key={date}>{date}</span>
        ))}
      </div>
    </div>
  );
}


function MiniGrowthGraphic() {
  return (
    <div className="reference-hero-graphic" aria-hidden="true">
      <svg viewBox="0 0 150 82">
        <polyline
          fill="none"
          points="10,58 30,48 48,50 66,40 86,38 108,24 128,14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        {[0, 1, 2, 3, 4].map((bar) => (
          <rect
            fill="currentColor"
            height={8 + bar * 7}
            key={bar}
            opacity={0.12 + bar * 0.05}
            rx="2"
            width="8"
            x={78 + bar * 14}
            y={66 - bar * 7}
          />
        ))}
        <circle cx="128" cy="14" fill="currentColor" r="5" />
      </svg>
      <span>
        <ArrowUpRight size={24} weight="bold" aria-hidden />
      </span>
    </div>
  );
}


function sameSkillSet(first: string[], second: string[]) {
  return (
    normalizeOwnedSkills(first).join("\u0000") ===
    normalizeOwnedSkills(second).join("\u0000")
  );
}


export function DailyDashboardHome({
  model,
  dataFailed,
  initialFilters = DEFAULT_DASHBOARD_FILTERS,
}: DailyDashboardHomeProps) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [ownedSkills, setOwnedSkills] = useState(model.ownedSkills);
  const [skillInput, setSkillInput] = useState("");
  const [stackMessage, setStackMessage] = useState("");
  const weeklyJobs = useMemo(() => buildWeeklyJobs(model.jobs), [model.jobs]);
  const filteredWeeklyJobs = useMemo(
    () => filterJobRows(weeklyJobs, filters),
    [weeklyJobs, filters],
  );
  const filteredDeadlineJobs = useMemo(
    () => filterJobRows(SAMPLE_DEADLINE_JOBS, filters),
    [filters],
  );
  const trendRows = useMemo(
    () => buildTrendRows(model.trendingSkills),
    [model.trendingSkills],
  );
  const leadTrend = trendRows[0]?.label ?? "Kubernetes";
  const secondTrend = trendRows[1]?.label ?? "Kafka";
  const matchedCount = Math.max(18, model.summary.matchedJobCount);
  const highFitCount = Math.max(7, model.summary.highFitJobCount);
  const urgentCount = Math.max(5, Math.min(model.summary.actionItemCount, 9));

  useEffect(() => {
    setOwnedSkills(model.ownedSkills);
  }, [model.ownedSkills]);

  useEffect(() => {
    const storedSkills = readOwnedSkills();
    if (storedSkills.length === 0) {
      return;
    }

    if (!sameSkillSet(storedSkills, ownedSkills)) {
      setOwnedSkills(storedSkills);
    }
    const hasUrlStack = new URLSearchParams(window.location.search).has("owned_skills");
    if (!hasUrlStack && !sameSkillSet(storedSkills, model.ownedSkills)) {
      router.replace(ownedSkillsToDashboardHref(storedSkills), { scroll: false });
    }
  }, [model.ownedSkills, ownedSkills, router]);

  function syncOwnedSkills(nextSkills: string[], message: string) {
    const savedSkills = writeOwnedSkills(nextSkills);
    setOwnedSkills(savedSkills);
    setStackMessage(message);
    router.replace(ownedSkillsToDashboardHref(savedSkills), { scroll: false });
  }

  function syncFilters(nextFilters: DashboardFilters) {
    setFilters(nextFilters);
    router.replace(
      dashboardFiltersToHref(nextFilters, window.location.search),
      { scroll: false },
    );
  }

  function handleAddSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSkill = skillInput.trim();
    if (!nextSkill) {
      setStackMessage("추가할 기술을 입력해주세요.");
      return;
    }

    if (ownedSkills.some((skill) => skill.toLowerCase() === nextSkill.toLowerCase())) {
      setSkillInput("");
      setStackMessage(`${nextSkill}는 이미 내 스택에 있어요.`);
      return;
    }

    syncOwnedSkills([...ownedSkills, nextSkill], `${nextSkill} 추가됨`);
    setSkillInput("");
  }

  function handleRemoveSkill(skillToRemove: string) {
    if (ownedSkills.length <= 1) {
      setStackMessage("최소 1개 기술은 남겨주세요.");
      return;
    }

    syncOwnedSkills(
      ownedSkills.filter((skill) => skill !== skillToRemove),
      `${skillToRemove} 제거됨`,
    );
  }

  return (
    <DashboardShell>
      <main className="daily-main reference-dashboard-main">
        {dataFailed && (
          <p className="sr-only" role="status">
            일부 API 응답이 비어 있어 표시용 예시 데이터를 함께 보여줍니다.
          </p>
        )}

        <header className="reference-topbar">
          <label className="reference-search" htmlFor="daily-search">
            <MagnifyingGlass size={22} weight="light" aria-hidden />
            <span className="sr-only">검색어</span>
            <input
              aria-label="검색어"
              id="daily-search"
              type="search"
              placeholder="기술, 직무, 기업을 검색하세요"
              value={filters.query}
              onChange={(event) =>
                syncFilters({ ...filters, query: event.target.value })
              }
            />
          </label>

          <div className="reference-filterbar" aria-label="대시보드 필터">
            <label className="reference-filter">
              <MapPin size={18} weight="regular" aria-hidden />
              <span className="sr-only">지역</span>
              <select
                aria-label="지역"
                value={filters.region}
                onChange={(event) =>
                  syncFilters({
                    ...filters,
                    region: event.target.value as DashboardFilters["region"],
                  })
                }
              >
                {REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <CaretDown size={15} weight="bold" aria-hidden />
            </label>
            <label className="reference-filter">
              <Briefcase size={18} weight="regular" aria-hidden />
              <span className="sr-only">경력</span>
              <select
                aria-label="경력"
                value={filters.career}
                onChange={(event) =>
                  syncFilters({
                    ...filters,
                    career: event.target.value as DashboardFilters["career"],
                  })
                }
              >
                {CAREER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <CaretDown size={15} weight="bold" aria-hidden />
            </label>
            <label className="reference-filter">
              <FunnelSimple size={18} weight="regular" aria-hidden />
              <span className="sr-only">기간</span>
              <select
                aria-label="기간"
                value={filters.period}
                onChange={(event) =>
                  syncFilters({
                    ...filters,
                    period: event.target.value as DashboardFilters["period"],
                  })
                }
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <CaretDown size={15} weight="bold" aria-hidden />
            </label>
          </div>

          <div className="reference-account">
            <button className="reference-bell" type="button" aria-label="알림">
              <Bell size={22} weight="regular" aria-hidden />
              <i />
            </button>
            <span className="reference-avatar">
              <UserCircle size={28} weight="duotone" aria-hidden />
            </span>
            <strong>김민준</strong>
            <CaretDown size={15} weight="bold" aria-hidden />
          </div>
        </header>

        <section className="reference-hero" aria-labelledby="weekly-summary-title">
          <div className="reference-orbit" aria-hidden="true">
            <span />
          </div>
          <div className="reference-hero-copy">
            <h1 id="weekly-summary-title">내 기술스택 기준 이번 주 요약</h1>
            <div className="reference-stack-editor" id="my-stack">
              <div className="reference-stack-chips" aria-label="분석 기준 기술스택">
                {ownedSkills.map((skill) => (
                  <button
                    aria-label={`${skill} 제거`}
                    className="reference-stack-chip"
                    key={skill}
                    onClick={() => handleRemoveSkill(skill)}
                    type="button"
                  >
                    <span>{skill}</span>
                    <X size={13} weight="bold" aria-hidden />
                  </button>
                ))}
              </div>
              <form
                aria-label="내 스택 편집"
                className="reference-stack-form"
                onSubmit={handleAddSkill}
              >
                <label className="sr-only" htmlFor="owned-skill-input">
                  내 스택에 추가할 기술
                </label>
                <input
                  aria-label="내 스택에 추가할 기술"
                  id="owned-skill-input"
                  placeholder="기술 추가"
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                />
                <button type="submit">추가</button>
              </form>
              <p className="reference-stack-status" role="status">
                {stackMessage}
              </p>
            </div>
            <p>
              {leadTrend}와 {secondTrend} 관련 공고가 이번 주 크게 증가했어요.
            </p>
          </div>
          <MiniGrowthGraphic />
        </section>

        <section className="reference-kpis" aria-label="이번 주 핵심 지표">
          <article className="reference-kpi-card">
            <header>
              <h2>신규 매칭 공고</h2>
              <Info size={16} weight="regular" aria-hidden />
            </header>
            <strong>{matchedCount}</strong>
            <p>
              <ArrowUp size={15} weight="bold" aria-hidden />
              38% <span>(지난주 대비)</span>
            </p>
            <Sparkline />
          </article>
          <article className="reference-kpi-card">
            <header>
              <h2>80% 이상 Fit</h2>
              <Info size={16} weight="regular" aria-hidden />
            </header>
            <strong>{highFitCount}</strong>
            <p>
              <ArrowUp size={15} weight="bold" aria-hidden />
              17% <span>(지난주 대비)</span>
            </p>
            <Sparkline />
          </article>
          <article className="reference-kpi-card reference-kpi-card--skill">
            <header>
              <h2>상승 기술</h2>
              <Info size={16} weight="regular" aria-hidden />
            </header>
            <strong>{leadTrend}</strong>
            <p>
              <ArrowUp size={15} weight="bold" aria-hidden />
              28% <span>(지난주 대비)</span>
            </p>
            <span className="reference-kpi-icon reference-kpi-icon--green">
              <TrendUp size={34} weight="bold" aria-hidden />
            </span>
          </article>
          <article className="reference-kpi-card reference-kpi-card--deadline">
            <header>
              <h2>마감 임박</h2>
              <Info size={16} weight="regular" aria-hidden />
            </header>
            <strong>{urgentCount}</strong>
            <p>
              <ArrowUp size={15} weight="bold" aria-hidden />
              2 <span>(지난주 대비)</span>
            </p>
            <span className="reference-kpi-icon reference-kpi-icon--orange">
              <Clock size={34} weight="bold" aria-hidden />
            </span>
          </article>
        </section>

        <section className="reference-dashboard-grid">
          <article className="reference-panel reference-panel--chart">
            <header className="reference-panel-header">
              <div>
                <h2>내 기술스택 기준 시장 변화</h2>
                <Info size={16} weight="regular" aria-hidden />
              </div>
              <div className="reference-range-tabs" aria-label="기간 선택">
                <button type="button">7일</button>
                <button className="is-active" type="button">30일</button>
                <button type="button">90일</button>
              </div>
            </header>
            <div className="reference-legend" aria-hidden="true">
              <span className="is-market">전체 시장</span>
              <span className="is-owned">내 기술스택 관련</span>
              <span className="is-jobs">신규 공고</span>
            </div>
            <WeeklyChart />
          </article>

          <article className="reference-panel" id="weekly-jobs">
            <header className="reference-panel-header">
              <h2>이번 주 신규 공고</h2>
              <a href="#weekly-jobs">전체 보기</a>
            </header>
            <div className="reference-table">
              {filteredWeeklyJobs.length > 0 ? (
                filteredWeeklyJobs.map((job) => (
                  <div className="reference-table-row" key={`${job.companyName}-${job.title}`}>
                    <CompanyMark companyName={job.companyName} tone={job.tone} />
                    <strong>{job.companyName}</strong>
                    <span>{job.title}</span>
                    <small>{job.location}</small>
                    <time>{job.time}</time>
                  </div>
                ))
              ) : (
                <div className="reference-empty-row" role="status">
                  조건에 맞는 신규 공고가 없습니다.
                </div>
              )}
            </div>
          </article>

          <article className="reference-panel">
            <header className="reference-panel-header">
              <div>
                <h2>급상승 관련 기술 TOP 5</h2>
                <Info size={16} weight="regular" aria-hidden />
              </div>
              <a href="/skills/graph">전체 보기</a>
            </header>
            <ol className="reference-trend-list">
              {trendRows.map((skill, index) => (
                <li key={skill.label}>
                  <span>{index + 1}</span>
                  <b>{skill.label}</b>
                  <strong>
                    <ArrowUp size={14} weight="bold" aria-hidden />
                    {skill.value}
                  </strong>
                </li>
              ))}
            </ol>
          </article>

          <article className="reference-panel">
            <header className="reference-panel-header">
              <h2>변경 / 마감 임박 공고</h2>
              <a href="#weekly-jobs">전체 보기</a>
            </header>
            <div className="reference-table reference-table--deadline">
              {filteredDeadlineJobs.length > 0 ? (
                filteredDeadlineJobs.map((job) => (
                  <div className="reference-table-row" key={`${job.companyName}-${job.date}`}>
                    <CompanyMark companyName={job.companyName} tone={job.tone} />
                    <strong>{job.companyName}</strong>
                    <span>{job.title}</span>
                    <b className={job.badge.startsWith("D-") ? "is-urgent" : "is-changed"}>
                      {job.badge}
                    </b>
                    <time>{job.date}</time>
                  </div>
                ))
              ) : (
                <div className="reference-empty-row" role="status">
                  조건에 맞는 마감 공고가 없습니다.
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
    </DashboardShell>
  );
}
