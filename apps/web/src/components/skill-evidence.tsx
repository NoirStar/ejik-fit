import type { SkillDetail } from "@/lib/types";


const GROUPS = [
  { type: "required", label: "필수 기술" },
  { type: "preferred", label: "우대 기술" },
  { type: "unspecified", label: "공고에 언급된 기술" },
] as const;


export function SkillEvidence({ skills }: { skills: SkillDetail[] }) {
  if (skills.length === 0) {
    return null;
  }

  return (
    <section className="skill-evidence" aria-label="기술 스킬">
      {GROUPS.map((group) => {
        const items = skills.filter(
          (skill) => skill.requirement_type === group.type,
        );
        if (items.length === 0) {
          return null;
        }

        return (
          <div className="skill-evidence__group" key={group.type}>
            <h2>{group.label}</h2>
            <ul className="skill-evidence__list">
              {items.map((skill) => (
                <li className="skill-evidence__item" key={skill.skill}>
                  <span className="skill-evidence__name">
                    {skill.skill}
                  </span>
                  {skill.evidence_text && (
                    <q className="skill-evidence__quote">
                      {skill.evidence_text}
                    </q>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
