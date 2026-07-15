"use client";

import { Plus, Trash, X } from "@phosphor-icons/react";
import type { FormEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import {
  addOwnedSkill,
  clearOwnedSkills,
  readOwnedSkills,
  removeOwnedSkill,
} from "@/lib/owned-skills";
import { trapTabKey } from "@/lib/focus-trap";

import styles from "./owned-skills-sheet.module.css";

type OwnedSkillsSheetProps = {
  open: boolean;
  onClose(): void;
  onSkillsChange?(skills: string[]): void;
  openerRef: RefObject<HTMLButtonElement | null>;
};

export function OwnedSkillsSheet({
  open,
  onClose,
  onSkillsChange,
  openerRef,
}: OwnedSkillsSheetProps) {
  const [skills, setSkills] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    setSkills(readOwnedSkills());
    setDraft("");
    setError("");
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      trapTabKey(event, sheetRef.current);
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        openerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, openerRef]);

  if (!open) return null;

  function closeSheet() {
    onClose();
    openerRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = draft.trim();
    if (!normalized) {
      setError("기술 이름을 입력해 주세요.");
      return;
    }
    if (skills.some((skill) => skill.toLocaleLowerCase("en-US") === normalized.toLocaleLowerCase("en-US"))) {
      setError("이미 저장한 기술입니다.");
      return;
    }

    const nextSkills = addOwnedSkill(normalized);
    setSkills(nextSkills);
    onSkillsChange?.(nextSkills);
    setDraft("");
    setError("");
  }

  function removeSkill(skill: string) {
    const nextSkills = removeOwnedSkill(skill);
    setSkills(nextSkills);
    onSkillsChange?.(nextSkills);
  }

  function clearSkills() {
    const nextSkills = clearOwnedSkills();
    setSkills(nextSkills);
    onSkillsChange?.(nextSkills);
  }

  return (
    <div className={styles.backdrop} onMouseDown={closeSheet}>
      <section
        aria-labelledby="owned-skills-title"
        aria-modal="true"
        className={styles.sheet}
        onMouseDown={(event) => event.stopPropagation()}
        ref={sheetRef}
        role="dialog"
      >
        <header className={styles.header}>
          <div>
            <h2 id="owned-skills-title">내 스택</h2>
            <p>공고와 기술 맵의 분석 기준을 직접 관리합니다.</p>
          </div>
          <button
            aria-label="내 스택 닫기"
            className={styles.iconButton}
            onClick={closeSheet}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={20} weight="bold" />
          </button>
        </header>

        <p className={styles.privacyNote}>
          로그인 전에는 이 브라우저에 저장되며, 로그인하면 계정과 동기화됩니다.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="owned-skill-input">추가할 기술</label>
          <div className={styles.inputRow}>
            <input
              aria-describedby={error ? "owned-skill-error" : undefined}
              id="owned-skill-input"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="예: Spring, React, Kubernetes"
              type="text"
              value={draft}
            />
            <button className={styles.addButton} type="submit">
              <Plus aria-hidden="true" size={18} weight="bold" />
              <span>기술 추가</span>
            </button>
          </div>
          {error && (
            <p className={styles.error} id="owned-skill-error" role="alert">
              {error}
            </p>
          )}
        </form>

        <div className={styles.listHeader}>
          <h3>저장한 기술</h3>
          {skills.length > 0 && (
            <button className={styles.clearButton} onClick={clearSkills} type="button">
              전체 삭제
            </button>
          )}
        </div>

        {skills.length === 0 ? (
          <div className={styles.empty}>
            <strong>아직 저장한 기술이 없습니다.</strong>
            <p>기술을 추가하면 관련 공식 공고와 인접 기술을 비교할 수 있습니다.</p>
          </div>
        ) : (
          <ul className={styles.skillList} aria-label="저장한 기술 목록">
            {skills.map((skill) => (
              <li key={skill}>
                <span>{skill}</span>
                <button
                  aria-label={`${skill} 제거`}
                  className={styles.removeButton}
                  onClick={() => removeSkill(skill)}
                  type="button"
                >
                  <Trash aria-hidden="true" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
