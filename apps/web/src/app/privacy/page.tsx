import type { Metadata } from "next";

import { TrustPageLayout } from "../trust-page-layout";
import { ClearLocalData } from "./clear-local-data";

export const metadata: Metadata = {
  title: "개인정보와 브라우저 저장",
  description: "계정 없이 사용하는 이직핏의 브라우저 저장 데이터와 삭제 방법입니다.",
};

export default function PrivacyPage() {
  return (
    <TrustPageLayout
      intro="현재 이직핏은 계정을 만들지 않으며, 사용자가 선택한 기술은 사용 중인 브라우저에 저장됩니다."
      title="개인정보와 브라우저 저장"
    >
      <section>
        <h2>계정과 로그인</h2>
        <p>현재 회원가입과 로그인 기능이 없으며 가짜 사용자 프로필을 표시하지 않습니다.</p>
      </section>

      <section>
        <h2>내 스택 저장</h2>
        <p>
          선택한 기술은 브라우저 localStorage의 <code>ejik-fit:owned-skills</code> 키에
          저장됩니다. 다른 브라우저나 기기로 자동 전송하거나 동기화하지 않습니다.
        </p>
      </section>

      <section>
        <h2>URL query</h2>
        <p>
          공고 검색 조건과 일부 기술 선택은 URL query에 포함될 수 있습니다. URL을
          공유하면 query 값도 함께 전달되므로 공유 전에 주소를 확인해 주세요.
        </p>
      </section>

      <section>
        <h2>저장 데이터 삭제</h2>
        <p>아래 버튼은 내 스택 localStorage와 현재 URL query를 이 브라우저에서 지웁니다.</p>
        <ClearLocalData />
      </section>
    </TrustPageLayout>
  );
}
