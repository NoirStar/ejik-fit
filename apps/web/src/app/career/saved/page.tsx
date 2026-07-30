import type { Metadata } from "next";

import {
  SavedLibrary,
  type SavedScope,
} from "@/features/saved-library/saved-library";
import { PRODUCT_TERMS } from "@/lib/labels";

export const metadata: Metadata = {
  title: PRODUCT_TERMS.savedItems,
  description:
    "이 기기와 계정에 저장한 공고, 커뮤니티 글과 지원 단계를 확인합니다.",
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
