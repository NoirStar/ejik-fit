"use client";

import { useState } from "react";

import styles from "../trust-pages.module.css";

export function ClearLocalData() {
  const [cleared, setCleared] = useState(false);

  function clearData() {
    window.localStorage.removeItem("ejik-fit:owned-skills");
    window.history.replaceState({}, "", window.location.pathname);
    setCleared(true);
  }

  return (
    <div>
      <button className={styles.clearButton} onClick={clearData} type="button">
        이 브라우저의 저장 데이터 삭제
      </button>
      {cleared && <p className={styles.status} role="status">저장 데이터를 삭제했습니다.</p>}
    </div>
  );
}
