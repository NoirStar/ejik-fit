import type {
  HiringCompanyActivity,
  HiringOverviewResponse,
  PostingSummary,
} from "@/lib/types";

export type CalendarDeadline = PostingSummary & {
  deadlineDateKey: string;
};

export type HiringCalendarDay = {
  dateKey: string;
  dayNumber: number;
  weekdayIndex: number;
  inMonth: boolean;
  isToday: boolean;
  deadlines: CalendarDeadline[];
};

export type HiringCalendarModel = {
  monthKey: string;
  label: string;
  previousMonthKey: string;
  nextMonthKey: string;
  rangeStart: string;
  rangeEnd: string;
  days: HiringCalendarDay[];
  monthDeadlines: CalendarDeadline[];
  monthDeadlineCount: number;
  closingNext7Days: number;
  undatedOpenPostings: number;
  activityCompanyTotal: number;
  activities: HiringCompanyActivity[];
  truncated: boolean;
};

const KOREA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function validMonthKey(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12;
}

function monthParts(monthKey: string) {
  if (!validMonthKey(monthKey)) {
    throw new Error(`Invalid calendar month: ${monthKey}`);
  }
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date: Date, days: number) {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

function shiftMonth(monthKey: string, offset: number) {
  const { year, month } = monthParts(monthKey);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(
    shifted.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

export function normalizeMonthKey(value: string | undefined, fallback: string) {
  if (value && validMonthKey(value)) return value;
  if (!validMonthKey(fallback)) {
    throw new Error(`Invalid fallback calendar month: ${fallback}`);
  }
  return fallback;
}

export function calendarRangeForMonth(monthKey: string) {
  const { year, month } = monthParts(monthKey);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = shiftDate(first, -mondayOffset);
  const end = shiftDate(start, 42);
  return { start: dateKey(start), end: dateKey(end) };
}

export function koreaDateKey(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  const parts = Object.fromEntries(
    KOREA_DATE_FORMATTER.formatToParts(parsed).map((part) => [
      part.type,
      part.value,
    ]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function buildHiringCalendarModel(
  overview: HiringOverviewResponse,
  monthKey: string,
  todayKey: string,
): HiringCalendarModel {
  const { year, month } = monthParts(monthKey);
  const range = calendarRangeForMonth(monthKey);
  const grouped = new Map<string, CalendarDeadline[]>();

  for (const posting of overview.deadlines) {
    if (!posting.closes_at) continue;
    const deadlineDateKey = koreaDateKey(posting.closes_at);
    if (
      deadlineDateKey < range.start ||
      deadlineDateKey >= range.end
    ) {
      continue;
    }
    const deadline = { ...posting, deadlineDateKey };
    grouped.set(deadlineDateKey, [
      ...(grouped.get(deadlineDateKey) ?? []),
      deadline,
    ]);
  }
  for (const deadlines of grouped.values()) {
    deadlines.sort((left, right) =>
      (left.closes_at ?? "").localeCompare(right.closes_at ?? ""),
    );
  }

  const startDate = new Date(`${range.start}T00:00:00Z`);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = shiftDate(startDate, index);
    const currentDateKey = dateKey(date);
    return {
      dateKey: currentDateKey,
      dayNumber: date.getUTCDate(),
      weekdayIndex: index % 7,
      inMonth: currentDateKey.startsWith(monthKey),
      isToday: currentDateKey === todayKey,
      deadlines: grouped.get(currentDateKey) ?? [],
    };
  });
  const monthDeadlines = days
    .filter((day) => day.inMonth)
    .flatMap((day) => day.deadlines);

  return {
    monthKey,
    label: `${year}년 ${month}월`,
    previousMonthKey: shiftMonth(monthKey, -1),
    nextMonthKey: shiftMonth(monthKey, 1),
    rangeStart: range.start,
    rangeEnd: range.end,
    days,
    monthDeadlines,
    monthDeadlineCount: monthDeadlines.length,
    closingNext7Days: overview.closing_next_7_days,
    undatedOpenPostings: overview.undated_open_postings,
    activityCompanyTotal: overview.activity_company_total,
    activities: overview.activities,
    truncated: overview.deadline_total > overview.deadlines.length,
  };
}
