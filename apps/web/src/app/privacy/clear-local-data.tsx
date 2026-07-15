"use client";

import { useState } from "react";

import { clearCareerPreferences } from "@/lib/career-preferences";
import { clearJobApplicationStages } from "@/lib/job-application-stages";
import { clearLocalCommunityPosts } from "@/lib/local-community-posts";
import { clearOwnedSkills } from "@/lib/owned-skills";
import { clearRecentCommunityTopics } from "@/lib/recent-community-topics";
import { clearSavedJobs } from "@/lib/saved-jobs";
import { clearSocialInteractions } from "@/lib/social-interactions";

import styles from "../trust-pages.module.css";

export function ClearLocalData() {
  const [result, setResult] = useState<"success" | "failure" | null>(null);

  function clearData() {
    let storageCleared = false;
    try {
      const storage = window.localStorage;
      clearOwnedSkills(storage);
      clearCareerPreferences(storage);
      clearLocalCommunityPosts(storage);
      clearRecentCommunityTopics(storage);
      clearSavedJobs(storage);
      clearJobApplicationStages(storage);
      clearSocialInteractions(storage);
      storageCleared =
        storage.getItem("ejik-fit:owned-skills") === null &&
        storage.getItem("ejik-fit:career-preferences") === null &&
        storage.getItem("ejik-fit:local-community-posts") === null &&
        storage.getItem("ejik-fit:recent-community-topics") === null &&
        storage.getItem("ejik-fit:saved-job-ids") === null &&
        storage.getItem("ejik-fit:job-application-stages") === null &&
        storage.getItem("ejik-fit:social-interactions") === null;
    } catch {
      storageCleared = false;
    }
    window.history.replaceState({}, "", window.location.pathname);
    setResult(storageCleared ? "success" : "failure");
  }

  return (
    <div>
      <button className={styles.clearButton} onClick={clearData} type="button">
        이 브라우저의 저장 데이터 삭제
      </button>
      {result === "success" && (
        <p className={styles.status} role="status">
          저장 데이터를 삭제했습니다.
        </p>
      )}
      {result === "failure" && (
        <p className={styles.status} role="alert">
          일부 저장 데이터를 삭제하지 못했습니다. 브라우저 저장소 설정을 확인해
          주세요.
        </p>
      )}
    </div>
  );
}
