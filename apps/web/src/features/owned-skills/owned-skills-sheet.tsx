"use client";

import { Trash, X } from "@phosphor-icons/react";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import {
  addOwnedSkill,
  clearOwnedSkills,
  readOwnedSkills,
  removeOwnedSkill,
} from "@/lib/owned-skills";
import { trapTabKey } from "@/lib/focus-trap";
import { PRODUCT_TERMS } from "@/lib/labels";
import { parseSkillCatalogResponse, skillNameKey } from "@/lib/skill-catalog";
import type { SkillCatalogItem } from "@/lib/types";

import { type CatalogStatus, SkillPicker } from "./skill-picker";
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
  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("idle");
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
    if (!open || catalogStatus !== "idle") return;
    setCatalogStatus("loading");

    void fetch("/api/skills/catalog", {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("skill catalog request failed");
        const items = parseSkillCatalogResponse(await response.json()).items;
        setCatalog(items);
        setCatalogStatus("ready");
      })
      .catch(() => {
        setCatalogStatus("error");
      });
  }, [catalogStatus, open]);

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

  function commitSkill(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      setError("기술 이름을 입력해 주세요.");
      return false;
    }
    const skillName = normalized;
    if (skills.some((skill) => skillNameKey(skill) === skillNameKey(skillName))) {
      setError("이미 추가한 기술입니다.");
      return false;
    }

    const nextSkills = addOwnedSkill(skillName);
    setSkills(nextSkills);
    onSkillsChange?.(nextSkills);
    setDraft("");
    setError("");
    return true;
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
            <h2 id="owned-skills-title">{PRODUCT_TERMS.ownedSkills}</h2>
            <p>공고와 스킬맵의 분석 기준을 직접 관리합니다.</p>
          </div>
          <button
            aria-label={`${PRODUCT_TERMS.ownedSkills} 닫기`}
            className={styles.iconButton}
            onClick={closeSheet}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={20} weight="bold" />
          </button>
        </header>

        <p className={styles.privacyNote}>
          로그인 전에는 이 브라우저에만 저장하고, 로그인하면 계정에도 저장합니다.
        </p>

        <div className={styles.picker}>
          <SkillPicker
            catalog={catalog}
            catalogStatus={catalogStatus}
            error={error}
            excludedSkills={skills}
            id="owned-skill-input"
            onCommit={commitSkill}
            onValueChange={(nextValue) => {
              setDraft(nextValue);
              setError("");
            }}
            value={draft}
          />
        </div>

        <div className={styles.listHeader}>
          <h3>추가한 기술</h3>
          {skills.length > 0 && (
            <button className={styles.clearButton} onClick={clearSkills} type="button">
              전체 삭제
            </button>
          )}
        </div>

        {skills.length === 0 ? (
          <div className={styles.empty}>
            <strong>아직 추가한 기술이 없습니다.</strong>
            <p>기술을 추가하면 관련 공식 공고와 인접 기술을 비교할 수 있습니다.</p>
          </div>
        ) : (
          <ul className={styles.skillList} aria-label="추가한 기술 목록">
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
