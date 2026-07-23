"use client";

import { Plus, Trash, X } from "@phosphor-icons/react";
import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  addOwnedSkill,
  clearOwnedSkills,
  readOwnedSkills,
  removeOwnedSkill,
} from "@/lib/owned-skills";
import { trapTabKey } from "@/lib/focus-trap";
import {
  normalizeSkillCategory,
  skillCategoryLabel,
} from "@/lib/skill-categories";
import {
  canonicalSkillName,
  parseSkillCatalogResponse,
  skillNameKey,
} from "@/lib/skill-catalog";
import type { SkillCatalogItem } from "@/lib/types";

import styles from "./owned-skills-sheet.module.css";

type OwnedSkillsSheetProps = {
  open: boolean;
  onClose(): void;
  onSkillsChange?(skills: string[]): void;
  openerRef: RefObject<HTMLButtonElement | null>;
};

type CatalogStatus = "idle" | "loading" | "ready" | "error";

const MAX_SUGGESTIONS = 8;
const SUGGESTION_LIST_ID = "owned-skill-suggestions";

function suggestionRank(name: string, query: string) {
  const normalizedName = skillNameKey(name);
  if (normalizedName === query) return 0;
  if (normalizedName.startsWith(query)) return 1;
  if (normalizedName.split(/[\s./+-]+/).some((part) => part.startsWith(query))) {
    return 2;
  }
  return normalizedName.includes(query) ? 3 : Number.POSITIVE_INFINITY;
}

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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const suggestions = useMemo(() => {
    const query = skillNameKey(draft);
    if (!query) return [];
    const owned = new Set(skills.map(skillNameKey));

    return catalog
      .map((item) => ({ item, rank: suggestionRank(item.name, query) }))
      .filter(
        ({ item, rank }) =>
          !owned.has(skillNameKey(item.name)) && Number.isFinite(rank),
      )
      .sort(
        (left, right) =>
          left.rank - right.rank ||
          left.item.name.localeCompare(right.item.name, "en"),
      )
      .slice(0, MAX_SUGGESTIONS)
      .map(({ item }) => item);
  }, [catalog, draft, skills]);

  useEffect(() => {
    if (!open) return;
    setSkills(readOwnedSkills());
    setDraft("");
    setError("");
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
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
    const skillName = canonicalSkillName(normalized, catalog);
    if (skills.some((skill) => skillNameKey(skill) === skillNameKey(skillName))) {
      setError("이미 저장한 기술입니다.");
      return false;
    }

    const nextSkills = addOwnedSkill(skillName);
    setSkills(nextSkills);
    onSkillsChange?.(nextSkills);
    setDraft("");
    setError("");
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    return true;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitSkill(draft);
  }

  function selectSuggestion(skill: SkillCatalogItem) {
    commitSkill(skill.name);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && suggestionsOpen) {
      event.preventDefault();
      event.stopPropagation();
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      return;
    }
    if (event.key === "Tab") {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      return;
    }
    if (suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
      return;
    }
    if (event.key === "Enter" && suggestionsOpen && activeSuggestion >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    }
  }

  function handleSuggestionMouseDown(
    event: ReactMouseEvent<HTMLLIElement>,
    skill: SkillCatalogItem,
  ) {
    event.preventDefault();
    selectSuggestion(skill);
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
            <h2 id="owned-skills-title">내 기술</h2>
            <p>공고와 스킬맵의 분석 기준을 직접 관리합니다.</p>
          </div>
          <button
            aria-label="내 기술 닫기"
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
            <div className={styles.combobox}>
              <input
                aria-activedescendant={
                  suggestionsOpen && activeSuggestion >= 0
                    ? `owned-skill-option-${activeSuggestion}`
                    : undefined
                }
                aria-autocomplete="list"
                aria-controls={
                  suggestionsOpen && suggestions.length > 0
                    ? SUGGESTION_LIST_ID
                    : undefined
                }
                aria-describedby={
                  error ? "owned-skill-error" : "owned-skill-catalog-hint"
                }
                aria-expanded={suggestionsOpen && suggestions.length > 0}
                autoComplete="off"
                id="owned-skill-input"
                onBlur={() => {
                  setSuggestionsOpen(false);
                  setActiveSuggestion(-1);
                }}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError("");
                  setSuggestionsOpen(true);
                  setActiveSuggestion(-1);
                }}
                onFocus={() => setSuggestionsOpen(Boolean(draft.trim()))}
                onKeyDown={handleInputKeyDown}
                placeholder="예: Spring, React, Kubernetes"
                role="combobox"
                type="text"
                value={draft}
              />
              {suggestionsOpen && suggestions.length > 0 && (
                <ul
                  aria-label="기술명 추천"
                  className={styles.suggestions}
                  id={SUGGESTION_LIST_ID}
                  role="listbox"
                >
                  {suggestions.map((skill, index) => (
                    <li
                      aria-selected={activeSuggestion === index}
                      data-active={activeSuggestion === index ? "true" : undefined}
                      id={`owned-skill-option-${index}`}
                      key={skill.name}
                      onMouseDown={(event) => handleSuggestionMouseDown(event, skill)}
                      onMouseEnter={() => setActiveSuggestion(index)}
                      role="option"
                    >
                      <strong>{skill.name}</strong>
                      <span>
                        {skillCategoryLabel(normalizeSkillCategory(skill.category))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
          {!error && (
            <p className={styles.catalogHint} id="owned-skill-catalog-hint">
              {catalogStatus === "loading" && "검증된 기술명 목록을 불러오는 중입니다."}
              {catalogStatus === "ready" && "목록에 없는 기술도 직접 입력할 수 있습니다."}
              {catalogStatus === "error" &&
                "추천 목록을 불러오지 못했지만 기술을 직접 입력할 수 있습니다."}
              {catalogStatus === "idle" && "기술명을 입력하면 표준 기술명을 추천합니다."}
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
