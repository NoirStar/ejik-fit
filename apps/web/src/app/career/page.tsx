import type { Metadata } from "next";
import Link from "next/link";

import { RouteShell } from "@/components/route-shell/route-shell";

export const metadata: Metadata = {
  title: "내 커리어",
  description: "로그인 없이 내 기술을 저장하고 관련 공식 채용 데이터를 확인합니다.",
};

export default function CareerPage() {
  return (
    <RouteShell
      action={<Link href="/#my-stack">홈에서 내 스택 설정하기</Link>}
      description="프로필을 꾸며내지 않고, 직접 고른 기술을 기준으로 관련 공고와 시장 근거를 연결합니다."
      eyebrow="브라우저에만 저장"
      title="내 커리어"
    >
      <p>
        로그인 기능이 준비되기 전에는 <strong>내 스택이 현재 브라우저에만 저장</strong>됩니다.
      </p>
      <p>이름, 연차, 회사 같은 개인정보를 임의로 만들거나 서버에 전송하지 않습니다.</p>
    </RouteShell>
  );
}
