import type { SkillStat } from "@/lib/types";
import { PRODUCT_TERMS } from "@/lib/labels";


const CATEGORY_LABELS: Record<string, string> = {
  language: "언어",
  frontend: "프론트엔드",
  backend: "백엔드",
  infra: "인프라",
  data: "데이터",
  ai: "AI",
  security: "보안",
  game: "게임",
  robotics: "로보틱스",
  mobile: "모바일",
};


const UNSPECIFIED_HELP_ID = "skill-ranking-unspecified-help";


export function SkillRanking({ stats }: { stats: SkillStat[] }) {
  if (stats.length === 0) {
    return null;
  }

  const max = Math.max(...stats.map((stat) => stat.count));

  return (
    <>
      <p className="skill-ranking__help" id={UNSPECIFIED_HELP_ID}>
        {PRODUCT_TERMS.unspecifiedRequirement}: 공고에서 필수 또는 우대로 구분하지 않은 기술
      </p>
      <ol className="skill-ranking">
        {stats.map((stat, index) => (
          <li key={stat.skill} className="skill-ranking__item">
            <span className="skill-ranking__rank">{index + 1}</span>
            <div className="skill-ranking__body">
              <div className="skill-ranking__head">
                <span className="skill-ranking__name">{stat.skill}</span>
                <span className="skill-ranking__category">
                  {CATEGORY_LABELS[stat.category] ?? stat.category}
                </span>
                <span className="skill-ranking__count">{stat.count}건</span>
              </div>
              <span
                aria-describedby={UNSPECIFIED_HELP_ID}
                aria-label={`필수 ${stat.required_count ?? 0}, 우대 ${stat.preferred_count ?? 0}, ${PRODUCT_TERMS.unspecifiedRequirement} ${stat.unspecified_count ?? 0}`}
                className="skill-ranking__breakdown"
              >
                필수 {stat.required_count ?? 0} · 우대{" "}
                {stat.preferred_count ?? 0} · {PRODUCT_TERMS.unspecifiedRequirementCompact}{" "}
                {stat.unspecified_count ?? 0}
              </span>
              <div
                className="skill-ranking__bar"
                style={{ width: `${Math.round((stat.count / max) * 100)}%` }}
                aria-hidden="true"
              />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
