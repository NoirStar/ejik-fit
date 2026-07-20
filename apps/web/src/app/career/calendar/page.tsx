import type { Metadata } from "next";

import { HiringCalendar } from "@/features/hiring-calendar/hiring-calendar";
import {
  buildHiringCalendarModel,
  calendarRangeForMonth,
  koreaDateKey,
  normalizeMonthKey,
} from "@/features/hiring-calendar/model";
import { getHiringOverview } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "채용 일정",
  description: "기업 공식 채용 공고에 명시된 마감일과 최근 확인된 채용 활동을 살펴봅니다.",
};

type CalendarSearchParams = Record<string, string | string[] | undefined>;

type HiringCalendarPageProps = {
  searchParams?: Promise<CalendarSearchParams>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HiringCalendarPage({
  searchParams,
}: HiringCalendarPageProps = {}) {
  const todayKey = koreaDateKey(new Date().toISOString());
  const params = (await searchParams) ?? {};
  const monthKey = normalizeMonthKey(first(params.month), todayKey.slice(0, 7));
  const range = calendarRangeForMonth(monthKey);

  try {
    const overview = await getHiringOverview({
      start: range.start,
      end: range.end,
      activityDays: 14,
      limit: 300,
    });
    return (
      <HiringCalendar
        model={buildHiringCalendarModel(overview, monthKey, todayKey)}
      />
    );
  } catch (error) {
    console.error("[hiring-calendar] request failed", error);
    return <HiringCalendar error model={null} />;
  }
}
