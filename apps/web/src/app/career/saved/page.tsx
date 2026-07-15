import type { Metadata } from "next";

import {
  SavedLibrary,
  type SavedScope,
} from "@/features/saved-library/saved-library";

export const metadata: Metadata = {
  title: "저장 보관함",
  description:
    "이 브라우저에 저장한 공식 공고, 직접 작성한 글과 커뮤니티 예시를 다시 확인합니다.",
  robots: { index: false, follow: false },
};

type SavedPageProps = {
  searchParams?: Promise<{ scope?: string | string[] }>;
};

function normalizeSavedScope(scope: string | string[] | undefined): SavedScope {
  const value = Array.isArray(scope) ? scope[0] : scope;
  if (
    value === "jobs" ||
    value === "applications" ||
    value === "community"
  ) {
    return value;
  }
  return "all";
}

export default async function SavedPage({ searchParams }: SavedPageProps = {}) {
  const params = searchParams ? await searchParams : undefined;
  return <SavedLibrary initialScope={normalizeSavedScope(params?.scope)} />;
}
