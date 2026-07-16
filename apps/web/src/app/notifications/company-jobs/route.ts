import { NextResponse } from "next/server";

import { getPostings } from "@/lib/api";

const MAX_COMPANIES = 20;
const COMPANY_SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

function normalizedCompanySlugs(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { company_slugs?: unknown }).company_slugs)
  ) {
    throw new TypeError("Invalid company job request");
  }

  const source = (value as { company_slugs: unknown[] }).company_slugs;
  if (source.length > MAX_COMPANIES) {
    throw new TypeError("Too many company filters");
  }
  const slugs: string[] = [];
  const seen = new Set<string>();
  for (const valueSlug of source) {
    if (typeof valueSlug !== "string") {
      throw new TypeError("Invalid company slug");
    }
    const slug = valueSlug.trim();
    if (!COMPANY_SLUG.test(slug)) {
      throw new TypeError("Invalid company slug");
    }
    if (!seen.has(slug)) {
      slugs.push(slug);
      seen.add(slug);
    }
  }
  return slugs;
}

export async function POST(request: Request) {
  let companySlugs: string[];
  try {
    companySlugs = normalizedCompanySlugs(await request.json());
  } catch {
    return NextResponse.json(
      { error: "유효한 관심 기업 목록이 필요합니다." },
      { status: 400 },
    );
  }

  if (companySlugs.length === 0) {
    return NextResponse.json(
      { items: [], total: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const postings = await getPostings({
      companies: companySlugs,
      limit: Math.min(100, Math.max(20, companySlugs.length * 5)),
    });
    const requestedCompanies = new Set(companySlugs);
    const items = postings.items.filter((posting) =>
      typeof posting.company_slug === "string" &&
      requestedCompanies.has(posting.company_slug),
    );
    return NextResponse.json({ items, total: items.length }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[notifications/company-jobs] request failed", error);
    return NextResponse.json(
      { error: "관심 기업 공고를 확인하지 못했습니다." },
      { status: 502 },
    );
  }
}
