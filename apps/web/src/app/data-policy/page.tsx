import type { Metadata } from "next";
import Link from "next/link";

import { SourceDirectory } from "@/features/sources/source-directory";
import { getSourceDirectory } from "@/lib/api";
import type { SourceDirectoryResponse } from "@/lib/types";

import { TrustPageLayout } from "../trust-page-layout";
import styles from "../trust-pages.module.css";

export const metadata: Metadata = {
  title: "데이터 수집 정책",
  description: "이직핏이 공식 채용공고를 수집하고 검증하며 마감 상태를 판단하는 원칙입니다.",
};

export const dynamic = "force-dynamic";

const SOURCE_REQUEST_URL =
  "https://github.com/NoirStar/ejik-fit/issues/new?" +
  new URLSearchParams({
    title: "[기업 수집 제안] 기업명",
    body: [
      "기업명:",
      "공식 채용페이지 URL:",
      "현재 확인한 기술 공고 URL (선택):",
      "제안 이유 (선택):",
      "",
      "※ 구직자 개인정보나 비공개 채용 정보는 작성하지 말아 주세요.",
    ].join("\n"),
  }).toString();

export default async function DataPolicyPage() {
  let directory: SourceDirectoryResponse | null = null;
  try {
    directory = await getSourceDirectory();
  } catch {
    directory = null;
  }

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
          모든 공고에 공식 출처와 마지막 확인 시각을 표시합니다. 일부 수집 결과를
          불러오지 못하면 성공한 데이터만 표시하고, 샘플 데이터로 빈 영역을 채우지
          않습니다.
        </p>
        <Link href="/corrections">정보 정정 요청 방법</Link>
      </section>

      <section className={styles.directorySection}>
        <div className={styles.directoryHeading}>
          <div>
            <h2>수집 기업과 공식 출처</h2>
            <p>
              서비스에 반영된 최신 상태를 기준으로 공개합니다. 수집 준비 중인 기업은
              공고 데이터가 서비스에 반영된 것으로 계산하지 않습니다.
            </p>
          </div>
          <div className={styles.directoryActions}>
            <a href={SOURCE_REQUEST_URL} rel="noreferrer" target="_blank">
              수집 기업 제안
            </a>
            <Link href="/jobs">수집된 공고 보기</Link>
          </div>
        </div>
        {directory ? (
          <SourceDirectory directory={directory} />
        ) : (
          <div className={styles.directoryError} role="status">
            <strong>수집 기업 목록을 불러오지 못했습니다.</strong>
            <span>공고 화면에는 영향이 없습니다. 잠시 후 다시 확인해 주세요.</span>
          </div>
        )}
      </section>
    </TrustPageLayout>
  );
}
