import type { Metadata } from "next";

import { AccountOverview } from "@/features/account/account-overview";

export const metadata: Metadata = {
  title: "계정 및 동기화",
  description: "로그인 상태와 계정에 동기화되는 커리어 정보 범위를 확인합니다.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountOverview />;
}
