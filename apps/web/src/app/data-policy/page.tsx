import type { Metadata } from "next";
import Link from "next/link";

import { getSourceDirectory } from "@/lib/api";
import type {
  SourceDirectoryItem,
  SourceDirectoryResponse,
} from "@/lib/types";

import { TrustPageLayout } from "../trust-page-layout";
import styles from "../trust-pages.module.css";

export const metadata: Metadata = {
  title: "데이터 수집 정책",
  description: "이직핏이 공식 채용공고를 수집하고 검증하며 마감 상태를 판단하는 원칙입니다.",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

function lastCollectedLabel(
  value: string | null,
  status: SourceDirectoryItem["collection_status"],
) {
  if (!value) {
    return status === "collecting" ? "최근 수집 시각 없음" : "첫 수집 준비 중";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 시각 점검 중";
  return `${DATE_FORMATTER.format(date)} 수집`;
}

function SourceRow({ item }: { item: SourceDirectoryItem }) {
  const isCollecting = item.collection_status === "collecting";

  return (
    <li className={styles.sourceRow}>
      <div className={styles.sourceIdentity}>
        <span aria-hidden="true" className={styles.companyInitial}>
          {item.company_name.slice(0, 1)}
        </span>
        <div>
          {isCollecting ? (
            <Link
              aria-label={`${item.company_name} 공고 보기`}
              href={`/companies/${encodeURIComponent(item.company_slug)}`}
            >
              {item.company_name}
            </Link>
          ) : (
            <strong>{item.company_name}</strong>
          )}
          <small>
            {lastCollectedLabel(item.last_success_at, item.collection_status)}
          </small>
        </div>
      </div>
      <div className={styles.sourceMeta}>
        <span
          className={styles.collectionStatus}
          data-status={item.collection_status}
        >
          {isCollecting ? "수집 중" : "연결 준비"}
        </span>
        {isCollecting && (
          <span className={styles.openCount}>열린 공고 {item.open_postings}건</span>
        )}
        <a
          aria-label={`${item.company_name} 공식 수집 출처`}
          href={item.careers_url}
          rel="noreferrer"
          target="_blank"
        >
          공식 출처 ↗
        </a>
      </div>
    </li>
  );
}

function SourceGroup({
  items,
  title,
  description,
}: {
  items: SourceDirectoryItem[];
  title: string;
  description: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={styles.sourceGroup}>
      <div className={styles.sourceGroupHeading}>
        <h3>{title}</h3>
        <span>{items.length}개 기업</span>
        <p>{description}</p>
      </div>
      <ul className={styles.sourceList}>
        {items.map((item) => (
          <SourceRow item={item} key={item.company_slug} />
        ))}
      </ul>
    </div>
  );
}

function SourceDirectory({ directory }: { directory: SourceDirectoryResponse }) {
  const collecting = directory.items.filter(
    (item) => item.collection_status === "collecting",
  );
  const preparing = directory.items.filter(
    (item) => item.collection_status === "preparing",
  );

  return (
    <>
      <div aria-label="수집 출처 요약" className={styles.directorySummary}>
        <span>수집 중 {directory.collecting_count}개 기업</span>
        <span>연결 준비 {directory.preparing_count}개 기업</span>
        <span>열린 공고 {directory.open_postings}건</span>
      </div>
      <SourceGroup
        description="정기 수집 대상이며, 확인된 열린 공고를 서비스에 반영하는 출처입니다."
        items={collecting}
        title="현재 수집 중"
      />
      <SourceGroup
        description="연결 방식 또는 수집 정책을 더 확인 중이며, 공고 수에는 포함하지 않습니다."
        items={preparing}
        title="연결 준비 중"
      />
    </>
  );
}

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
          모든 공고에 공식 출처와 마지막 확인 시각을 표시합니다. 일부 API가 실패하면
          성공한 데이터만 표시하고, 샘플 데이터로 빈 영역을 채우지 않습니다.
        </p>
        <Link href="/corrections">정보 정정 요청 방법</Link>
      </section>

      <section className={styles.directorySection}>
        <div className={styles.directoryHeading}>
          <div>
            <h2>수집 기업과 공식 출처</h2>
            <p>
              운영 DB의 현재 상태를 기준으로 공개합니다. 수집 준비 중인 기업은 공고
              데이터가 서비스에 반영된 것으로 계산하지 않습니다.
            </p>
          </div>
          <Link href="/jobs">수집된 공고 보기</Link>
        </div>
        {directory ? (
          <SourceDirectory directory={directory} />
        ) : (
          <div className={styles.directoryError} role="status">
            <strong>수집 기업 목록을 불러오지 못했습니다.</strong>
            <span>공고 데이터는 계속 이용할 수 있으며, 잠시 후 다시 확인해주세요.</span>
          </div>
        )}
      </section>
    </TrustPageLayout>
  );
}
