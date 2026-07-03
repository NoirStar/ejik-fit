import { JobCard } from "@/components/job-card";
import { getPostings } from "@/lib/api";
import type { PostingListResponse } from "@/lib/types";


export const dynamic = "force-dynamic";


type HomeProps = {
  searchParams: Promise<{
    q?: string;
    career_type?: string;
  }>;
};


export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const newcomerOnly = params.career_type === "new_comer";
  let result: PostingListResponse | null = null;
  let failed = false;

  try {
    result = await getPostings({
      q: q || undefined,
      career_type: newcomerOnly ? "new_comer" : undefined,
    });
  } catch {
    failed = true;
  }

  return (
    <main>
      <section className="intro">
        <div>
          <p className="intro__label">한국 기술직 채용 탐색</p>
          <h1>기업 채용페이지를 한곳에서 찾으세요.</h1>
          <p className="intro__copy">
            IT, 보안, 게임, ROS 공고를 공식 출처에서 확인합니다.
          </p>
        </div>
        <aside className="intro__aside">
          <strong>출처가 먼저입니다.</strong>
          <p>
            모든 공고에 원문 링크와 마지막 확인 시각을 남깁니다.
          </p>
        </aside>
      </section>

      <section className="search-section" aria-labelledby="search-title">
        <h2 id="search-title" className="sr-only">
          채용공고 검색
        </h2>
        <form className="search-form" action="/" method="get">
          <label htmlFor="q">직무, 기술, 기업</label>
          <div className="search-form__controls">
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="예: 보안, Python, ROS"
            />
            <label className="newcomer-filter">
              <input
                type="checkbox"
                name="career_type"
                value="new_comer"
                defaultChecked={newcomerOnly}
              />
              신입 공고만
            </label>
            <button type="submit">찾기</button>
          </div>
        </form>
      </section>

      <section className="results" aria-labelledby="results-title">
        <div className="results__header">
          <h2 id="results-title">공식 채용공고</h2>
          <span>{result?.total ?? 0}건</span>
        </div>

        {failed && (
          <div className="state-message" role="alert">
            <strong>공고를 불러오지 못했습니다.</strong>
            <p>API 상태를 확인한 뒤 다시 시도해 주세요.</p>
          </div>
        )}

        {!failed && result?.items.length === 0 && (
          <div className="state-message">
            <strong>조건에 맞는 공고가 없습니다.</strong>
            <p>검색어를 줄이거나 신입 필터를 해제해 보세요.</p>
          </div>
        )}

        {!failed && result && result.items.length > 0 && (
          <div className="job-list">
            {result.items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
