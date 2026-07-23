import type { Metadata } from "next";

import { AccountOverview } from "@/features/account/account-overview";

export const metadata: Metadata = {
  title: "계정",
  description: "프로필과 계정에 저장된 커리어 데이터를 관리합니다.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountOverview />;
}
