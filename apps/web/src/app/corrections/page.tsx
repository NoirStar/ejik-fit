import type { Metadata } from "next";

import { TrustPageLayout } from "../trust-page-layout";
import styles from "../trust-pages.module.css";

const ISSUES_URL = "https://github.com/NoirStar/ejik-fit/issues";

export const metadata: Metadata = {
  title: "정보 정정 요청",
  description: "공고 정보 오류, 기업 정정과 삭제 요청을 공개 이슈로 접수하는 방법입니다.",
};

export default function CorrectionsPage() {
  return (
    <TrustPageLayout
      intro="잘못된 공고 정보와 출처 문제를 확인할 수 있도록 공개 저장소에서 정정 요청을 받습니다."
      title="정보 정정 요청"
    >
      <section>
        <h2>요청할 수 있는 내용</h2>
        <ul>
          <li>공고 제목, 근무지, 경력 조건 또는 상태 오류</li>
          <li>공식 출처 URL 변경 또는 잘못 연결된 출처</li>
          <li>기업 담당자의 정정, 제외 또는 삭제 요청</li>
          <li>기술 추출과 필수·우대 분류 오류</li>
        </ul>
      </section>

      <section>
        <h2>요청에 포함할 정보</h2>
        <ol>
          <li>문제가 있는 이직핏 공고 URL</li>
          <li>확인 가능한 기업 공식 채용페이지 URL</li>
          <li>잘못된 항목과 원하는 정정 내용</li>
          <li>기업 담당 요청인 경우 확인 가능한 설명</li>
        </ol>
      </section>

      <section>
        <h2>공개 이슈로 접수</h2>
        <p>
          개인 이메일이나 존재하지 않는 운영자 정보를 제공하지 않습니다. 민감한 개인정보는
          이슈에 작성하지 마세요.
        </p>
        <a className={styles.primaryLink} href={ISSUES_URL} rel="noreferrer" target="_blank">
          GitHub Issues에서 요청하기
        </a>
      </section>
    </TrustPageLayout>
  );
}
