import type { Metadata } from "next";

import { FollowedCompanies } from "@/features/companies/followed-companies";
import { getSourceDirectory } from "@/lib/api";
import type { SourceDirectoryResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관심 기업",
  description: "관심 기업의 현재 열린 공고와 확인 상태를 관리합니다.",
};

export default async function FollowedCompaniesPage() {
  let directory: SourceDirectoryResponse | null = null;
  try {
    directory = await getSourceDirectory();
  } catch {
    directory = null;
  }

  return (
    <FollowedCompanies
      directory={directory}
      directoryUnavailable={directory === null}
    />
  );
}
