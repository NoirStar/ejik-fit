"use client";

import {
  ArrowClockwise,
  ArrowRight,
  BookmarkSimple,
  Buildings,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  Clock,
  Info,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CompanyMark } from "@/features/home-feed/company-mark";
import { formatCareerRange } from "@/features/jobs/model";
import {
  readFollowedCompanySlugs,
  subscribeFollowedCompanies,
} from "@/lib/followed-companies";
import { formatEmployment } from "@/lib/labels";
import {
  readSavedJobIds,
  subscribeSavedJobs,
} from "@/lib/saved-jobs";

import type {
  CalendarDeadline,
  HiringCalendarDay,
  HiringCalendarModel,
} from "./model";
import styles from "./hiring-calendar.module.css";

type CalendarFilter = "all" | "saved" | "followed";

type HiringCalendarProps = {
  error?: boolean;
  model: HiringCalendarModel | null;
};

const FILTERS: ReadonlyArray<{
  id: CalendarFilter;
  label: string;
}> = [
  { id: "all", label: "전체" },
  { id: "saved", label: "저장 공고" },
  { id: "followed", label: "관심 기업" },
];

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const UPCOMING_PAGE_SIZE = 8;

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Seoul",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

function parsedDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value: string | null | undefined) {
  const date = parsedDate(value);
  return date ? DATE_LABEL_FORMATTER.format(date) : "날짜 확인 필요";
}

function dateTimeLabel(value: string | null | undefined) {
  const date = parsedDate(value);
  return date ? DATE_TIME_FORMATTER.format(date) : "시각 확인 필요";
}

function filterDeadline(
  deadline: CalendarDeadline,
  filter: CalendarFilter,
  savedIds: ReadonlySet<string>,
  followedCompanySlugs: ReadonlySet<string>,
) {
  if (filter === "saved") return savedIds.has(deadline.id);
  if (filter === "followed") {
    return Boolean(
      deadline.company_slug &&
        followedCompanySlugs.has(deadline.company_slug),
    );
  }
  return true;
}

function CalendarDeadlineLink({
  deadline,
  followed,
  saved,
}: {
  deadline: CalendarDeadline;
  followed: boolean;
  saved: boolean;
}) {
  return (
    <Link
      aria-label={`${deadline.company_name} ${deadline.title}, ${dateLabel(
        deadline.closes_at,
      )} 마감`}
      className={styles.deadlineLink}
      data-followed={followed ? "true" : undefined}
      data-saved={saved ? "true" : undefined}
      href={`/jobs/${encodeURIComponent(deadline.id)}`}
      title={`${deadline.company_name} ${deadline.title}`}
    >
      {saved && (
        <BookmarkSimple
          aria-hidden="true"
          className={styles.savedIcon}
          size={11}
          weight="fill"
        />
      )}
      <span>{deadline.company_name}</span>
      <strong>{deadline.title}</strong>
    </Link>
  );
}

function CalendarDay({
  day,
  followedCompanySlugs,
  savedIds,
}: {
  day: HiringCalendarDay;
  followedCompanySlugs: ReadonlySet<string>;
  savedIds: ReadonlySet<string>;
}) {
  const visibleDeadlines = day.deadlines.slice(0, 3);
  const remaining = day.deadlines.length - visibleDeadlines.length;

  return (
    <div
      aria-label={`${day.dateKey}, 명시 마감 공고 ${day.deadlines.length}건${
        day.isToday ? ", 오늘" : ""
      }${day.inMonth ? "" : ", 선택 월 밖"} `}
      className={styles.day}
      data-outside={day.inMonth ? undefined : "true"}
      data-today={day.isToday ? "true" : undefined}
      role="gridcell"
    >
      <time className={styles.dayNumber} dateTime={day.dateKey}>
        {day.dayNumber}
        {day.isToday && <span className={styles.srOnly}>오늘</span>}
      </time>

      <div className={styles.desktopDeadlines}>
        {visibleDeadlines.map((deadline) => (
          <CalendarDeadlineLink
            deadline={deadline}
            followed={Boolean(
              deadline.company_slug &&
                followedCompanySlugs.has(deadline.company_slug),
            )}
            key={deadline.id}
            saved={savedIds.has(deadline.id)}
          />
        ))}
        {remaining > 0 && (
          <span className={styles.moreDeadlines}>외 {remaining}건</span>
        )}
      </div>

      {day.deadlines.length > 0 && (
        <span
          aria-hidden="true"
          className={styles.mobileDeadlineCount}
          data-multiple={day.deadlines.length > 1 ? "true" : undefined}
        >
          {day.deadlines.length}
        </span>
      )}
    </div>
  );
}

function UpcomingDeadline({
  deadline,
  followed,
  saved,
}: {
  deadline: CalendarDeadline;
  followed: boolean;
  saved: boolean;
}) {
  return (
    <li>
      <Link
        aria-label={`${deadline.company_name} ${deadline.title} 상세 보기`}
        className={styles.upcomingLink}
        data-followed={followed ? "true" : undefined}
        href={`/jobs/${encodeURIComponent(deadline.id)}`}
      >
        <time dateTime={deadline.closes_at ?? undefined}>
          <Clock aria-hidden="true" size={14} />
          {dateTimeLabel(deadline.closes_at)} 마감
        </time>
        <span className={styles.upcomingIdentity}>
          <CompanyMark
            companyName={deadline.company_name}
            size={34}
            sourceUrl={deadline.source_url}
          />
          <span>
            <small>{deadline.company_name}</small>
            <strong>{deadline.title}</strong>
          </span>
          <ArrowRight aria-hidden="true" size={14} weight="bold" />
        </span>
        <span className={styles.upcomingMeta}>
          {formatCareerRange(deadline)}
          <span aria-hidden="true">/</span>
          {formatEmployment(deadline.employment_type)}
          {deadline.location && (
            <>
              <span aria-hidden="true">/</span>
              {deadline.location}
            </>
          )}
          {saved && (
            <span className={styles.savedLabel}>
              <BookmarkSimple aria-hidden="true" size={12} weight="fill" />
              저장
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function HiringCalendar({ error = false, model }: HiringCalendarProps) {
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [followedCompanySlugs, setFollowedCompanySlugs] = useState<string[]>([]);
  const [visibleDeadlineCount, setVisibleDeadlineCount] = useState(
    UPCOMING_PAGE_SIZE,
  );

  useEffect(() => {
    setSavedJobIds(readSavedJobIds());
    setFollowedCompanySlugs(readFollowedCompanySlugs());
    const stopSaved = subscribeSavedJobs(setSavedJobIds);
    const stopFollowed = subscribeFollowedCompanies(setFollowedCompanySlugs);
    return () => {
      stopSaved();
      stopFollowed();
    };
  }, []);

  useEffect(() => {
    setVisibleDeadlineCount(UPCOMING_PAGE_SIZE);
  }, [filter, model?.monthKey]);

  const savedIds = useMemo(() => new Set(savedJobIds), [savedJobIds]);
  const followedSlugs = useMemo(
    () => new Set(followedCompanySlugs),
    [followedCompanySlugs],
  );

  const filteredModel = useMemo(() => {
    if (!model) return null;
    const include = (deadline: CalendarDeadline) =>
      filterDeadline(deadline, filter, savedIds, followedSlugs);
    return {
      days: model.days.map((day) => ({
        ...day,
        deadlines: day.deadlines.filter(include),
      })),
      deadlines: model.monthDeadlines.filter(include),
    };
  }, [filter, followedSlugs, model, savedIds]);

  if (error || !model || !filteredModel) {
    return (
      <main className={styles.page}>
        <header className={styles.intro}>
          <div>
            <h1>채용 일정</h1>
            <p>공식 채용공고의 마감일과 최근 기업 활동을 확인합니다.</p>
          </div>
        </header>
        <section className={styles.errorState} role="alert">
          <CalendarBlank aria-hidden="true" size={28} />
          <div>
            <h2>채용 일정 데이터를 불러오지 못했습니다.</h2>
            <p>잠시 후 다시 시도해 주세요.</p>
          </div>
          <button onClick={() => window.location.reload()} type="button">
            <ArrowClockwise aria-hidden="true" size={16} />
            다시 시도
          </button>
        </section>
      </main>
    );
  }

  const filterLabel =
    FILTERS.find((item) => item.id === filter)?.label ?? "전체";
  const hasFilteredDeadlines = filteredModel.deadlines.length > 0;
  const todayKey = model.days.find((day) => day.isToday)?.dateKey;
  const panelDeadlines = todayKey
    ? filteredModel.deadlines.filter(
        (deadline) => deadline.deadlineDateKey >= todayKey,
      )
    : filteredModel.deadlines;
  const visibleDeadlines = panelDeadlines.slice(0, visibleDeadlineCount);
  const hiddenDeadlineCount =
    panelDeadlines.length - visibleDeadlines.length;
  const nextDeadlineCount = Math.min(
    UPCOMING_PAGE_SIZE,
    hiddenDeadlineCount,
  );

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <h1>채용 일정</h1>
          <p>공식 채용공고의 마감일과 최근 기업 활동을 확인합니다.</p>
        </div>
        <Link className={styles.jobsLink} href="/jobs">
          공고 보기
          <ArrowRight aria-hidden="true" size={15} weight="bold" />
        </Link>
      </header>

      <section aria-label="채용 일정 데이터 기준" className={styles.notice}>
        <Info aria-hidden="true" size={18} weight="fill" />
        <div>
          <strong>이직핏이 확인한 기업 공식 채용 공고 범위입니다.</strong>
          <p>
            명시된 마감일만 달력에 표시합니다. 최초 확인일은 기업의 실제 게시일과
            다를 수 있습니다.
          </p>
        </div>
      </section>

      <section aria-label="채용 일정 요약" className={styles.summary}>
        <dl>
          <div>
            <dt>선택 월 마감</dt>
            <dd>{filteredModel.deadlines.length.toLocaleString("ko-KR")}건</dd>
            <span>{filterLabel} 표시 기준</span>
          </div>
          <div>
            <dt>7일 내 마감</dt>
            <dd>{model.closingNext7Days.toLocaleString("ko-KR")}건</dd>
            <span>전체 열린 공고 기준</span>
          </div>
          <div>
            <dt>마감일 미표기</dt>
            <dd>{model.undatedOpenPostings.toLocaleString("ko-KR")}건</dd>
            <span>달력에는 표시하지 않음</span>
          </div>
          <div>
            <dt>최근 14일 활동 기업</dt>
            <dd>{model.activityCompanyTotal.toLocaleString("ko-KR")}곳</dd>
            <span>이직핏 최초 확인 기준</span>
          </div>
        </dl>
      </section>

      <section className={styles.controls}>
        <nav aria-label="채용 일정 월 이동" className={styles.monthNavigation}>
          <Link
            aria-label={`${model.previousMonthKey} 채용 일정 보기`}
            href={`/career/calendar?month=${model.previousMonthKey}`}
          >
            <CaretLeft aria-hidden="true" size={17} weight="bold" />
          </Link>
          <h2>{model.label}</h2>
          <Link
            aria-label={`${model.nextMonthKey} 채용 일정 보기`}
            href={`/career/calendar?month=${model.nextMonthKey}`}
          >
            <CaretRight aria-hidden="true" size={17} weight="bold" />
          </Link>
        </nav>

        <div aria-label="채용 일정 표시 범위" className={styles.filters} role="group">
          {FILTERS.map((item) => (
            <button
              aria-pressed={filter === item.id}
              key={item.id}
              onClick={() => setFilter(item.id)}
              type="button"
            >
              {item.id === "saved" && (
                <BookmarkSimple aria-hidden="true" size={14} />
              )}
              {item.id === "followed" && (
                <Buildings aria-hidden="true" size={14} />
              )}
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className={styles.workspace}>
        <section
          aria-label={`${model.label} 채용 달력`}
          className={styles.calendarPanel}
          role="region"
        >
          <div aria-hidden="true" className={styles.weekdays}>
            {WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div
            aria-colcount={7}
            aria-label={`${model.label}, 월요일부터 일요일 순서`}
            aria-rowcount={6}
            className={styles.calendarGrid}
            role="grid"
          >
            {filteredModel.days.map((day) => (
              <CalendarDay
                day={day}
                followedCompanySlugs={followedSlugs}
                key={day.dateKey}
                savedIds={savedIds}
              />
            ))}
          </div>

          {!hasFilteredDeadlines && (
            <div className={styles.calendarEmpty}>
              <CalendarBlank aria-hidden="true" size={22} />
              <p>
                {filter === "all"
                  ? "표시할 채용 일정이 없습니다."
                  : `${filterLabel}에 해당하는 명시 마감 공고가 없습니다.`}
              </p>
              {filter !== "all" && (
                <button onClick={() => setFilter("all")} type="button">
                  전체 일정 보기
                </button>
              )}
            </div>
          )}

          {model.truncated && (
            <p className={styles.truncatedNote}>
              표시 한도를 넘은 공고가 있어 일부 일정만 표시합니다.
            </p>
          )}
        </section>

        <aside className={styles.sideColumn}>
          <section
            aria-labelledby="upcoming-deadlines-title"
            className={styles.sidePanel}
          >
            <header className={styles.sideHeader}>
              <div>
                <h2 id="upcoming-deadlines-title">
                  {todayKey ? "가까운 마감 공고" : `${model.label} 마감 공고`}
                </h2>
                <span>{filterLabel} 기준</span>
              </div>
              <CalendarBlank aria-hidden="true" size={19} />
            </header>

            {panelDeadlines.length > 0 ? (
              <>
                <ol className={styles.upcomingList}>
                  {visibleDeadlines.map((deadline) => (
                    <UpcomingDeadline
                      deadline={deadline}
                      followed={Boolean(
                        deadline.company_slug &&
                          followedSlugs.has(deadline.company_slug),
                      )}
                      key={deadline.id}
                      saved={savedIds.has(deadline.id)}
                    />
                  ))}
                </ol>
                {hiddenDeadlineCount > 0 && (
                  <button
                    aria-label={`${nextDeadlineCount}건 더 보기`}
                    className={styles.showMore}
                    onClick={() =>
                      setVisibleDeadlineCount((current) =>
                        Math.min(
                          panelDeadlines.length,
                          current + UPCOMING_PAGE_SIZE,
                        ),
                      )
                    }
                    type="button"
                  >
                    {nextDeadlineCount}건 더 보기
                    <CaretDown aria-hidden="true" size={13} weight="bold" />
                  </button>
                )}
              </>
            ) : (
              <div className={styles.compactState}>
                <strong>
                  {todayKey
                    ? "이달에 남은 명시 마감 공고가 없습니다."
                    : "표시할 명시 마감 공고가 없습니다."}
                </strong>
                <p>다른 필터를 선택하거나 달력에서 이전 일정을 확인할 수 있습니다.</p>
              </div>
            )}
          </section>

          <section
            aria-labelledby="company-activity-title"
            className={styles.sidePanel}
          >
            <header className={styles.sideHeader}>
              <div>
                <h2 id="company-activity-title">최근 기업 활동</h2>
                <span>최근 14일</span>
              </div>
              <Buildings aria-hidden="true" size={19} />
            </header>

            {model.activities.length > 0 ? (
              <ul className={styles.activityList}>
                {model.activities.map((activity) => (
                  <li key={activity.company_slug}>
                    <Link href={`/companies/${activity.company_slug}`}>
                      <CompanyMark
                        companyName={activity.company_name}
                        size={32}
                      />
                      <span>
                        <strong>{activity.company_name}</strong>
                        <small>
                          새로 확인한 열린 공고{" "}
                          {activity.new_postings.toLocaleString("ko-KR")}건
                        </small>
                        <span>
                          {dateTimeLabel(activity.latest_first_seen_at)} 최초 확인
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" size={14} weight="bold" />
                    </Link>
                    {activity.nearest_deadline_at && (
                      <p>
                        가장 가까운 마감{" "}
                        {dateLabel(activity.nearest_deadline_at)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.compactState}>
                <strong>최근 확인된 기업 활동이 없습니다.</strong>
                <p>새로 확인한 열린 공고가 생기면 이곳에 표시합니다.</p>
              </div>
            )}
            <p className={styles.sideFootnote}>
              기업 공식 채용페이지에서 이직핏이 처음 확인한 시각입니다.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
