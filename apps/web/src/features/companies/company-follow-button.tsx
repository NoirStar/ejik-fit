"use client";

import { BookmarkSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import {
  readFollowedCompanySlugs,
  subscribeFollowedCompanies,
  toggleFollowedCompany,
} from "@/lib/followed-companies";

import styles from "./company-follow-button.module.css";

export function CompanyFollowButton({
  companyName,
  companySlug,
}: {
  companyName: string;
  companySlug: string;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [followedSlugs, setFollowedSlugs] = useState<string[]>([]);
  const followed = followedSlugs.includes(companySlug);

  useEffect(() => {
    setFollowedSlugs(readFollowedCompanySlugs());
    setHydrated(true);
    return subscribeFollowedCompanies(setFollowedSlugs);
  }, []);

  return (
    <button
      aria-label={
        followed
          ? `${companyName} 관심 기업에서 제거`
          : `${companyName} 관심 기업으로 저장`
      }
      aria-pressed={followed}
      className={styles.button}
      data-followed={followed ? "true" : undefined}
      disabled={!hydrated}
      onClick={() => setFollowedSlugs(toggleFollowedCompany(companySlug))}
      type="button"
    >
      <BookmarkSimple
        aria-hidden="true"
        size={16}
        weight={followed ? "fill" : "bold"}
      />
      {followed ? "관심 기업 저장됨" : "관심 기업"}
    </button>
  );
}
