import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobDetailView } from "@/features/jobs/job-detail-view";
import { ApiError, getPosting } from "@/lib/api";
import { formatCareer } from "@/lib/labels";
import { normalizePostingDetail } from "@/lib/posting-contract";
import type { PostingDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

type JobDetailProps = {
  params: Promise<{ id: string }>;
};

async function postingOrNotFound(id: string) {
  try {
    return normalizePostingDetail(await getPosting(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: JobDetailProps): Promise<Metadata> {
  const { id } = await params;
  const job = await postingOrNotFound(id);
  const location = job.location ?? "근무지 미기재";
  const career = formatCareer(job.career_type);

  return {
    title: `${job.title} - ${job.company_name}`,
    description: `${job.company_name} ${job.title}. ${location}, ${career} 공식 채용공고입니다.`,
    alternates: { canonical: `/jobs/${encodeURIComponent(id)}` },
  };
}

function jobPostingJsonLd(job: PostingDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    url: job.source_url,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company_name,
    },
    ...(job.location
      ? {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location,
            },
          },
        }
      : {}),
    ...(job.employment_type ? { employmentType: job.employment_type } : {}),
    ...(job.opens_at ? { datePosted: job.opens_at } : {}),
    ...(job.closes_at ? { validThrough: job.closes_at } : {}),
  };
}

export default async function JobDetail({ params }: JobDetailProps) {
  const { id } = await params;
  const job = await postingOrNotFound(id);
  const jsonLd = JSON.stringify(jobPostingJsonLd(job)).replace(/</g, "\\u003c");

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: jsonLd }} type="application/ld+json" />
      <JobDetailView job={job} />
    </>
  );
}
