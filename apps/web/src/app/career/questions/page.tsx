import type { Metadata } from "next";

import { AuthoredQuestions } from "@/features/authored-questions/authored-questions";

export const metadata: Metadata = {
  title: "내 글",
  description: "계정에 작성한 커뮤니티 글을 확인하고 관리합니다.",
  robots: { index: false, follow: false },
};

export default function QuestionsPage() {
  return <AuthoredQuestions />;
}
