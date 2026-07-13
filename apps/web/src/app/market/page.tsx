import type { Metadata } from "next";
import Link from "next/link";

import { RouteShell } from "@/components/route-shell/route-shell";

export const metadata: Metadata = {
  title: "채용 시장",
  description: "공식 채용공고에서 확인한 기술 수요를 살펴보는 이직핏 시장 화면입니다.",
};

export default function MarketPage() {
  return (
    <RouteShell
      action={<Link href="/#market-insights">홈의 실데이터 요약 보기</Link>}
      description="기술별 수요와 실제 공고 근거를 더 깊게 비교하는 전용 화면을 준비하고 있습니다."
      eyebrow="공식 공고 데이터"
      title="채용 시장"
    >
      <p>
        현재 확인된 <strong>기술 수요 건수와 필수·우대 표기 수</strong>는 홈의 채용 시장
        요약에서 먼저 제공합니다.
      </p>
      <p>변화율이나 예측치는 충분한 시계열 근거가 마련되기 전까지 표시하지 않습니다.</p>
    </RouteShell>
  );
}
