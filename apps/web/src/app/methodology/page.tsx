import type { Metadata } from "next";
import Link from "next/link";

import { TrustPageLayout } from "../trust-page-layout";

export const metadata: Metadata = {
  title: "분석 방법",
  description: "기술 추출, 필수·우대 근거, 요구 기술 일치도와 기술 그래프의 계산 원칙입니다.",
};

export default function MethodologyPage() {
  return (
    <TrustPageLayout
      intro="공고 원문에서 기술 요구를 규칙 기반으로 추출하고, 결과와 근거를 함께 제공합니다."
      title="분석 방법"
    >
      <section>
        <h2>기술 추출</h2>
        <p>
          기술 사전과 별칭 규칙을 사용하며 별도 LLM으로 공고 내용을 추측하지 않습니다.
          Go, C, R처럼 일반 단어와 겹칠 수 있는 이름은 주변 문맥 정책을 함께 적용합니다.
        </p>
        <p>신뢰도 0.80 미만 후보는 기본 통계와 화면에서 제외합니다.</p>
      </section>

      <section>
        <h2>필수와 우대 근거</h2>
        <p>
          공고의 자격요건, 우대사항과 기술 소개 구역을 구분해 필수, 우대, 단순 언급으로
          분류합니다. 가능한 경우 각 기술과 함께 원문 근거 문장을 표시합니다.
        </p>
      </section>

      <section>
        <h2>요구 기술 일치도</h2>
        <p>
          사용자가 선택한 기술과 공고에서 확인된 요구 기술의 겹침을 나타냅니다.
          이 수치는 채용 가능성을 예측하지 않습니다. 서류 통과 확률이나 합격률로
          해석해서는 안 됩니다.
        </p>
      </section>

      <section>
        <h2>수요와 연결 관계</h2>
        <p>
          기술 수요는 현재 분석 범위에 포함된 공식 공고의 언급 건수입니다. 기술 연결은
          같은 공고에서 함께 확인된 횟수를 사용합니다. 표본 수와 수집 범위가 작으면
          시장 전체의 추세로 일반화하지 않습니다.
        </p>
        <Link href="/data-policy">데이터 범위 확인</Link>
      </section>
    </TrustPageLayout>
  );
}
