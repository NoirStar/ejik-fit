import Link from "next/link";

import { JobCard } from "@/components/job-card";
import { LandingMotion } from "@/components/landing-motion";
import { SkillRanking } from "@/components/skill-ranking";
import { getPostings, getSkillStats } from "@/lib/api";
import type { PostingListResponse, SkillStat } from "@/lib/types";


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
  let skills: SkillStat[] = [];

  const careerType = newcomerOnly ? "new_comer" : undefined;

  const [postingsResult, skillsResult] = await Promise.allSettled([
    getPostings({ q: q || undefined, career_type: careerType }),
    getSkillStats({ career_type: careerType, limit: 15 }),
  ]);

  if (postingsResult.status === "fulfilled") {
    result = postingsResult.value;
  } else {
    failed = true;
  }
  if (skillsResult.status === "fulfilled") {
    skills = skillsResult.value.items;
  }

  const marqueeSkills =
    skills.length > 0
      ? skills.slice(0, 10).map((skill) => skill.skill)
      : ["Python", "C++", "ROS2", "Linux", "Go", "Kubernetes", "RAG"];
  const scrubWords = [
    "ejik은",
    "공고",
    "검색보다",
    "먼저",
    "시장",
    "요구를",
    "읽습니다.",
    "내",
    "스킬에서",
    "관련",
    "분야와",
    "부족한",
    "준비를",
    "한",
    "화면으로",
    "연결합니다.",
  ];

  return (
    <main className="landing-page overflow-x-hidden w-full max-w-full">
      <LandingMotion />

      <section className="landing-hero">
        <div className="landing-hero__copy">
          <p className="eyebrow">채용공고 기반 커리어 인텔리전스</p>
          <h1>내 기술이 시장에서 어디로 이어지는지 봅니다.</h1>
          <p>
            공개 채용공고에서 반복되는 기술 조합을 분석해, 지금 가진 스킬과
            부족한 준비, 관련 공고를 하나의 대시보드로 연결합니다.
          </p>
          <div className="hero-actions">
            <Link className="button button--primary" href="/skills/graph">
              대시보드 열기
            </Link>
            <a className="button button--ghost" href="#jobs">
              공고 보기
            </a>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-visual__image" />
          <div className="hero-orbit hero-orbit--python">Python</div>
          <div className="hero-orbit hero-orbit--cpp">C++</div>
          <div className="hero-orbit hero-orbit--ros">ROS2</div>
          <div className="hero-orbit hero-orbit--linux">Linux</div>
          <div className="hero-orbit hero-orbit--security">Security</div>
          <svg className="hero-visual__lines" viewBox="0 0 100 100">
            <line x1="28" y1="52" x2="51" y2="30" />
            <line x1="28" y1="52" x2="62" y2="61" />
            <line x1="51" y1="30" x2="73" y2="43" />
            <line x1="62" y1="61" x2="43" y2="76" />
            <line x1="73" y1="43" x2="43" y2="76" />
          </svg>
        </div>
      </section>

      <section className="marquee-section" aria-label="주요 기술 흐름">
        <div className="marquee-track">
          {[...marqueeSkills, ...marqueeSkills].map((skill, index) => (
            <span key={`${skill}-${index}`}>{skill}</span>
          ))}
        </div>
      </section>

      <section className="bento-section" id="trends" aria-labelledby="bento-title">
        <div className="section-heading">
          <h2 id="bento-title">공고 검색보다 먼저 시장 지도를 만듭니다.</h2>
          <p>
            게임, AI, 보안, ROS, 임베디드처럼 섞이는 직무를 기술 관계와
            공고 근거로 분해해 다음 준비 방향을 보여줍니다.
          </p>
        </div>

        <div className="bento-grid">
          <article className="bento-card bento-card--large group-card">
            <div className="bento-card__media bento-card__media--graph" />
            <h3>스킬 관계를 시장 신호로 봅니다.</h3>
            <p>
              C++ 하나를 눌러도 ROS2, RTOS, Unreal, CUDA처럼 분야별로 갈라지는
              다음 선택지가 보입니다.
            </p>
          </article>
          <article className="bento-card group-card">
            <h3>필수와 우대를 분리합니다.</h3>
            <p>같은 기술도 반드시 필요한지, 있으면 좋은지 다르게 계산합니다.</p>
          </article>
          <article className="bento-card bento-card--tall group-card">
            <h3>혼합 직무를 놓치지 않습니다.</h3>
            <p>
              게임 + AI + 보안처럼 한 공고 안에서 섞인 요구사항을 하나의
              관계망으로 보여줍니다.
            </p>
          </article>
          <article className="bento-card group-card">
            <h3>오탐을 줄입니다.</h3>
            <p>C, R, Go처럼 일반 단어와 충돌하는 기술은 문맥과 근거를 봅니다.</p>
          </article>
          <article className="bento-card group-card">
            <h3>원문 근거를 남깁니다.</h3>
            <p>그래프의 모든 관계는 실제 공개 공고로 되돌아갈 수 있어야 합니다.</p>
          </article>
        </div>
      </section>

      <section className="accordion-section" aria-labelledby="accordion-title">
        <div className="section-heading section-heading--compact">
          <h2 id="accordion-title">어느 방향으로 준비할지 비교합니다.</h2>
        </div>
        <div className="horizontal-accordion">
          {[
            ["ROS / 임베디드", "C++, Linux, CAN, RTOS, 센서 처리"],
            ["게임 / 그래픽스", "C++, Unreal, Unity, Blender, Rendering"],
            ["AI / 데이터", "Python, RAG, MLOps, CUDA, Feature Store"],
            ["보안 / 인프라", "Go, Kubernetes, IAM, OAuth, Observability"],
          ].map(([title, copy]) => (
            <article className="accordion-slice group-card" key={title}>
              <div className="accordion-slice__image" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pin-section" id="roadmap" aria-labelledby="roadmap-title">
        <div className="pin-title">
          <h2 id="roadmap-title">그래프는 공부 목록이 아니라 선택 근거입니다.</h2>
        </div>
        <div className="pin-content">
          <p className="scrub-copy">
            {scrubWords.map((word) => (
              <span className="scrub-word" key={word}>
                {word}
              </span>
            ))}
          </p>
          <div className="roadmap-cards">
            <article className="roadmap-card gsap-image-reveal">
              <span>입력</span>
              <strong>내 스킬을 저장</strong>
              <p>로그인 없이 브라우저에 보유 스킬을 저장하고 그래프 기준점으로 씁니다.</p>
            </article>
            <article className="roadmap-card gsap-image-reveal">
              <span>분석</span>
              <strong>부족한 요구사항 확인</strong>
              <p>필수 스킬과 우대 스킬을 나눠 현재 fit을 설명합니다.</p>
            </article>
            <article className="roadmap-card gsap-image-reveal">
              <span>행동</span>
              <strong>다음 준비 스킬 결정</strong>
              <p>공고 수와 관계 강도를 기준으로 학습 우선순위를 정합니다.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="search-section" id="jobs" aria-labelledby="search-title">
        <h2 id="search-title" className="sr-only">
          채용공고 검색
        </h2>
        <form className="search-form" action="/" method="get">
          <label htmlFor="q">공고 검색</label>
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

      {skills.length > 0 && (
        <section className="skills-section" aria-labelledby="skills-title">
          <div className="results__header">
            <h2 id="skills-title">
              {newcomerOnly ? "신입 공고에서" : "공고에서"} 많이 요구되는 스킬
            </h2>
            <span>상위 {skills.length}개</span>
          </div>
          <SkillRanking stats={skills} />
        </section>
      )}

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

      <section className="final-cta" aria-labelledby="final-cta-title">
        <div>
          <h2 id="final-cta-title">지금 가진 기술에서 시장 fit을 확인하세요.</h2>
        </div>
        <Link className="button button--primary" href="/skills/graph">
          대시보드에서 보기
        </Link>
      </section>
    </main>
  );
}
