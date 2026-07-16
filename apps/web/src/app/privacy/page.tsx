import type { Metadata } from "next";

import { TrustPageLayout } from "../trust-page-layout";
import { ClearLocalData } from "./clear-local-data";

export const metadata: Metadata = {
  title: "개인정보와 계정 저장",
  description: "이직핏 로그인과 브라우저·계정 저장 데이터, 삭제 방법을 안내합니다.",
};

export default function PrivacyPage() {
  return (
    <TrustPageLayout
      intro="로그인하지 않으면 선택한 기술, 관심 기업과 저장 공고가 이 브라우저에만 남습니다. 이메일로 로그인하면 내 스택, 비교 조건, 관심 기업, 저장 공고와 지원 단계를 계정에 동기화합니다."
      title="개인정보와 계정 저장"
    >
      <section>
        <h2>계정과 로그인</h2>
        <p>
          이메일 주소로 일회용 로그인 링크를 요청할 수 있습니다. 인증과 세션
          쿠키는 Supabase Auth를 사용하며, 이직핏은 별도 비밀번호를 받거나
          저장하지 않습니다.
        </p>
      </section>

      <section>
        <h2>저장한 공고</h2>
        <p>
          저장 버튼을 누른 공고 ID는 <code>ejik-fit:saved-job-ids</code> 키에
          저장됩니다. 로그인하면 공고 ID만 계정에 동기화하며, 공고 내용이나
          기업 정보는 사용자 데이터로 복사하지 않습니다.
        </p>
      </section>

      <section>
        <h2>지원 단계</h2>
        <p>
          사용자가 직접 선택한 공고별 지원 단계는{" "}
          <code>ejik-fit:job-application-stages</code> 키에 저장됩니다. 실제 지원
          여부를 기업 시스템에서 확인하거나 자동으로 추정하지 않습니다. 로그인
          상태에서는 사용자가 선택한 단계만 계정에 동기화합니다.
        </p>
      </section>

      <section>
        <h2>관심 기업</h2>
        <p>
          관심 기업으로 저장한 공식 기업 식별자는{" "}
          <code>ejik-fit:followed-company-slugs</code> 키에 저장됩니다. 로그인하면
          식별자만 계정에 동기화하며, 기업 공고 본문을 사용자 데이터로 복사하지
          않습니다.
        </p>
      </section>

      <section>
        <h2>커뮤니티 상호작용</h2>
        <p>
          예시 글의 공감·저장, 작성자 팔로우와 사용자가 직접 작성한 로컬 댓글은
          {" "}<code>ejik-fit:social-interactions</code> 키에 저장됩니다. 팔로우한
          작성자도 예시 콘텐츠의 가상 작성자이며, 현재 계정이나 서버로 전송하지
          않습니다.
        </p>
      </section>

      <section>
        <h2>내가 작성한 로컬 글</h2>
        <p>
          커뮤니티 글쓰기에서 직접 작성한 글의 제목, 본문, 태그, 작성 시각은{" "}
          <code>ejik-fit:local-community-posts</code> 키에 저장됩니다. 서버
          커뮤니티에 게시하거나 검색 API로 전송하지 않으며 다른 브라우저와
          동기화하지 않습니다.
        </p>
      </section>

      <section>
        <h2>최근 본 커뮤니티 주제</h2>
        <p>
          커뮤니티 상세에서 확인한 글 ID, 제목, 대표 태그, 출처와 마지막 열람
          시각은 <code>ejik-fit:recent-community-topics</code> 키에 저장됩니다.
          본문·작성자·반응 수는 복사하지 않고 서버로 전송하지 않으며 다른
          브라우저와 동기화하지 않습니다.
        </p>
      </section>

      <section>
        <h2>내 스택 저장</h2>
        <p>
          선택한 기술은 브라우저 localStorage의 <code>ejik-fit:owned-skills</code> 키에
          저장됩니다. 로그인하면 계정 데이터와 병합해 다른 기기에서도 불러옵니다.
        </p>
      </section>

      <section>
        <h2>커리어 비교 조건</h2>
        <p>
          선택한 경력 조건과 희망 기술 분야는{" "}
          <code>ejik-fit:career-preferences</code> 키에 저장됩니다. 비교할 때 실제
          공고 분석 요청에 포함되며, 로그인 상태에서는 계정에 동기화합니다.
        </p>
      </section>

      <section>
        <h2>계정에 동기화하지 않는 정보</h2>
        <p>
          로컬 커뮤니티 글과 댓글, 예시 글 공감·팔로우, 최근 본 커뮤니티 주제는
          로그인 후에도 이 브라우저에만 남습니다. 예시 콘텐츠의 활동을 실제
          사용자 계정 활동처럼 저장하지 않습니다.
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
        <p>
          아래 버튼은 내 스택, 커리어 비교 조건, 작성한 로컬 글, 최근 본 주제,
          저장한 공고 ID, 지원 단계, 관심 기업, 커뮤니티 상호작용, 현재 URL query를 이
          브라우저에서 지웁니다. 이 버튼은 브라우저 삭제 결과만 확인하며, 계정
          데이터 삭제는 로그인 상태와 동기화 상태에 따라 별도로 확인해야 합니다.
        </p>
        <ClearLocalData />
      </section>
    </TrustPageLayout>
  );
}
