import type { Metadata } from "next";

import { SavedLibrary } from "@/features/saved-library/saved-library";

export const metadata: Metadata = {
  title: "저장 보관함",
  description:
    "이 브라우저에 저장한 공식 공고, 직접 작성한 글과 커뮤니티 예시를 다시 확인합니다.",
  robots: { index: false, follow: false },
};

export default function SavedPage() {
  return <SavedLibrary />;
}
