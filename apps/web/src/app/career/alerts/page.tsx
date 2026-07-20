import type { Metadata } from "next";

import { SavedSearchManager } from "@/features/saved-searches/saved-search-manager";

export const metadata: Metadata = {
  title: "공고 알림",
  description: "저장한 공고 검색 조건과 새로 확인된 공식 공고를 관리합니다.",
  robots: { index: false, follow: false },
};

export default function AlertsPage() {
  return <SavedSearchManager />;
}
