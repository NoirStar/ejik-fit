"use client";

import { useState } from "react";

import styles from "@/app/jobs/[id]/job-detail.module.css";
import type { PostingDescriptionImage } from "@/lib/types";

export function JobDescriptionImages({
  images,
}: {
  images: PostingDescriptionImage[];
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const visible = images.filter((image) => !failed.has(image.url));

  if (visible.length === 0) return null;

  return (
    <section
      aria-label="기업이 제공한 공고 상세 이미지"
      className={styles.sourceImages}
    >
      <p>기업이 이미지로 제공한 공고 내용입니다.</p>
      {visible.map((image) => (
        <img
          alt={image.alt}
          decoding="async"
          fetchPriority="low"
          key={image.url}
          loading="lazy"
          onError={() => {
            setFailed((current) => new Set(current).add(image.url));
          }}
          referrerPolicy="no-referrer"
          src={image.url}
        />
      ))}
    </section>
  );
}
