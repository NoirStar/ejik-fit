import { parsePostingDescription } from "./job-detail-model";
import styles from "@/app/jobs/[id]/job-detail.module.css";

export function PostingDescription({ text }: { text: string }) {
  const blocks = parsePostingDescription(text);

  if (blocks.length === 0) {
    return (
      <p className={styles.descriptionEmpty}>
        제공된 공고 원문이 없습니다. 기업 채용페이지를 확인해 주세요.
      </p>
    );
  }

  return (
    <div className={styles.descriptionBody}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h3
              data-source-level={block.level}
              key={`${block.text}-${index}`}
            >
              {block.text}
            </h3>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={`list-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={`paragraph-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}
