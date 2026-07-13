import type { Metadata } from "next";
import Link from "next/link";

import { TrustPageLayout } from "../trust-page-layout";

export const metadata: Metadata = {
  title: "데이터 수집 정책",
  description: "이직핏이 공식 채용공고를 수집하고 검증하며 마감 상태를 판단하는 원칙입니다.",
};

export default function DataPolicyPage() {
  return (
    <TrustPageLayout
      intro="공개된 기업 채용페이지를 존중하며, 확인 가능한 범위와 시각을 함께 공개합니다."
      title="데이터 수집 정책"
    >
      <section>
        <h2>수집하는 정보</h2>
        <p>
          로그인 없이 접근 가능한 기업 공식 채용페이지만 수집합니다. 공고 제목,
          직무 조건, 근무지, 본문, 공식 출처 URL과 마지막 확인 시각을 저장합니다.
        </p>
        <Link href="/jobs">현재 공식 공고 보기</Link>
      </section>

      <section>
        <h2>접근 통제 존중</h2>
        <ul>
          <li>인증, 로그인, CAPTCHA 또는 기타 접근 통제를 우회하지 않습니다.</li>
          <li>401, 403 또는 CAPTCHA가 감지되면 해당 출처를 검토 상태로 전환합니다.</li>
          <li>공개 범위가 바뀐 출처는 자동 수집을 강행하지 않습니다.</li>
        </ul>
      </section>

      <section>
        <h2>마감과 삭제 판단</h2>
        <p>
          한 번의 네트워크 오류나 파싱 실패로 공고를 마감 처리하지 않습니다. 정상적인
          채용 목록에서 3회 연속 사라진 공고만 마감 상태로 전환합니다.
        </p>
      </section>

      <section>
        <h2>화면에 표시하는 기준</h2>
        <p>
          모든 공고에 공식 출처와 마지막 확인 시각을 표시합니다. 일부 API가 실패하면
          성공한 데이터만 표시하고, 샘플 데이터로 빈 영역을 채우지 않습니다.
        </p>
        <Link href="/corrections">정보 정정 요청 방법</Link>
      </section>
    </TrustPageLayout>
  );
}
