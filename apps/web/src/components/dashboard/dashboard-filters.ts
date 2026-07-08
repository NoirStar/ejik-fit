export type RegionFilter = "all" | "seoul" | "gyeonggi" | "remote";
export type CareerFilter = "all" | "newcomer" | "experienced" | "any";
export type PeriodFilter = "all" | "today" | "week" | "deadline";


export type DashboardFilters = {
  query: string;
  region: RegionFilter;
  career: CareerFilter;
  period: PeriodFilter;
};


export type FilterableJobRow = {
  companyName: string;
  title: string;
  location: string;
  time: string;
  careerLabel: string;
  skills?: string[];
  badge?: string;
};


export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  query: "",
  region: "all",
  career: "all",
  period: "all",
};


const FILTER_KEYS = ["q", "region", "career", "period"] as const;


function normalized(value: string) {
  return value.trim().toLowerCase();
}


function validRegion(value: string | null): RegionFilter {
  return value === "seoul" || value === "gyeonggi" || value === "remote"
    ? value
    : "all";
}


function validCareer(value: string | null): CareerFilter {
  return value === "newcomer" || value === "experienced" || value === "any"
    ? value
    : "all";
}


function validPeriod(value: string | null): PeriodFilter {
  return value === "today" || value === "week" || value === "deadline"
    ? value
    : "all";
}


function matchesQuery(row: FilterableJobRow, query: string) {
  const value = normalized(query);
  if (!value) {
    return true;
  }

  return [
    row.companyName,
    row.title,
    row.location,
    row.time,
    row.careerLabel,
    ...(row.skills ?? []),
  ].some((item) => normalized(item).includes(value));
}


function matchesRegion(row: FilterableJobRow, region: RegionFilter) {
  if (region === "all") {
    return true;
  }
  if (region === "seoul") {
    return row.location.includes("서울");
  }
  if (region === "gyeonggi") {
    return /(경기|성남|판교|분당|수원|용인|하남|과천|안양|고양|부천)/.test(row.location);
  }
  return /(원격|재택|remote)/i.test(row.location);
}


function matchesCareer(row: FilterableJobRow, career: CareerFilter) {
  if (career === "all") {
    return true;
  }
  if (career === "newcomer") {
    return row.careerLabel.includes("신입");
  }
  if (career === "experienced") {
    return row.careerLabel.includes("경력") && !row.careerLabel.includes("무관");
  }
  return row.careerLabel.includes("무관");
}


function matchesPeriod(row: FilterableJobRow, period: PeriodFilter) {
  if (period === "all") {
    return true;
  }
  if (period === "today") {
    return /(분 전|시간 전|오늘|방금)/.test(row.time);
  }
  if (period === "deadline") {
    return row.badge?.startsWith("D-") ?? false;
  }
  return /(분 전|시간 전|오늘|어제|[1-7]일 전|D-[0-7])/.test(row.time);
}


export function filterJobRows<T extends FilterableJobRow>(
  rows: T[],
  filters: DashboardFilters,
) {
  return rows.filter(
    (row) =>
      matchesQuery(row, filters.query) &&
      matchesRegion(row, filters.region) &&
      matchesCareer(row, filters.career) &&
      matchesPeriod(row, filters.period),
  );
}


export function dashboardFiltersFromSearchParams(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): DashboardFilters {
  const pick = (key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  };

  return {
    query: pick("q")?.trim() ?? "",
    region: validRegion(pick("region")),
    career: validCareer(pick("career")),
    period: validPeriod(pick("period")),
  };
}


export function dashboardFiltersToHref(
  filters: DashboardFilters,
  currentSearch = "",
) {
  const params = new URLSearchParams(currentSearch);
  FILTER_KEYS.forEach((key) => params.delete(key));

  if (filters.query.trim()) {
    params.set("q", filters.query.trim());
  }
  if (filters.region !== "all") {
    params.set("region", filters.region);
  }
  if (filters.career !== "all") {
    params.set("career", filters.career);
  }
  if (filters.period !== "all") {
    params.set("period", filters.period);
  }

  const query = params.toString();
  return `/${query ? `?${query}` : ""}#weekly-jobs`;
}
