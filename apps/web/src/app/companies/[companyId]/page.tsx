import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompanyProfile } from "@/features/companies/company-profile";
import { settledResource } from "@/features/home-feed/resource-state";
import { getPostings, getSourceDirectory } from "@/lib/api";
import type { PostingListResponse, SourceDirectoryItem } from "@/lib/types";

export const dynamic = "force-dynamic";

type CompanyPageProps = {
  params: Promise<{ companyId: string }>;
};

const COMPANY_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

function companySlugOrNotFound(value: string) {
  if (!COMPANY_SLUG_PATTERN.test(value)) notFound();
  return value;
}

async function loadCompanyPostings(companySlug: string) {
  const response = await getPostings({ company: companySlug, limit: 100 });
  const items = response.items.filter(
    (posting) =>
      posting.company_slug === undefined || posting.company_slug === companySlug,
  );
  return { items, total: response.total } satisfies PostingListResponse;
}

async function loadCompanySource(
  companySlug: string,
): Promise<SourceDirectoryItem | null> {
  try {
    const directory = await getSourceDirectory();
    return (
      directory.items.find((item) => item.company_slug === companySlug) ?? null
    );
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: CompanyPageProps): Promise<Metadata> {
  const { companyId } = await params;
  const companySlug = companySlugOrNotFound(companyId);
  const canonical = `/companies/${encodeURIComponent(companySlug)}`;

  try {
    const [postings, source] = await Promise.all([
      loadCompanyPostings(companySlug),
      loadCompanySource(companySlug),
    ]);
    const companyName = postings.items[0]?.company_name ?? source?.company_name;
    const total = Math.max(postings.total, source?.open_postings ?? 0);
    return {
      title: companyName ? `${companyName} 채용 현황` : "기업 채용 현황",
      description: companyName
        ? `${companyName}의 공식 채용페이지에서 현재 확인된 공개 공고 ${total}건과 요구 기술을 확인합니다.`
        : "공식 채용페이지에서 현재 확인되는 기업 공개 공고를 살펴봅니다.",
      alternates: { canonical },
    };
  } catch {
    return {
      title: "기업 채용 현황",
      description: "공식 채용페이지에서 현재 확인되는 기업 공개 공고를 살펴봅니다.",
      alternates: { canonical },
    };
  }
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { companyId } = await params;
  const companySlug = companySlugOrNotFound(companyId);
  const [resource, source] = await Promise.all([
    settledResource(
      loadCompanyPostings(companySlug),
      "기업 공고 데이터를 불러오지 못했습니다.",
    ),
    loadCompanySource(companySlug),
  ]);

  if (resource.status === "error") {
    return (
      <CompanyProfile
        companySlug={companySlug}
        error
        postings={null}
        source={source}
      />
    );
  }

  return (
    <CompanyProfile
      companySlug={companySlug}
      postings={resource.data}
      source={source}
    />
  );
}
