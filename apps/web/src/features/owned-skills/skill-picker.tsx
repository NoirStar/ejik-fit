"use client";

import { Plus } from "@phosphor-icons/react";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  normalizeSkillCategory,
  skillCategoryLabel,
} from "@/lib/skill-categories";
import { canonicalSkillName, skillNameKey } from "@/lib/skill-catalog";
import type { SkillCatalogItem } from "@/lib/types";

import styles from "./skill-picker.module.css";

export type CatalogStatus = "idle" | "loading" | "ready" | "error";

type SkillPickerProps = {
  catalog: readonly SkillCatalogItem[];
  catalogStatus: CatalogStatus;
  error?: string;
  excludedSkills: readonly string[];
  id: string;
  onCommit(value: string): boolean | void;
  onValueChange(value: string): void;
  value: string;
};

type PickerRow =
  | { kind: "catalog"; skill: SkillCatalogItem }
  | { kind: "direct"; value: string };

const MAX_SUGGESTIONS = 6;

const SKILL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "C#": ["csharp", "씨샵"],
  "C++": ["cpp", "씨플플"],
  JavaScript: ["js", "자바스크립트"],
  Kubernetes: ["k8s", "쿠버네티스"],
  "Node.js": ["node", "nodejs", "노드"],
  PostgreSQL: ["postgres", "포스트그레스"],
  React: ["reactjs", "리액트"],
  Spring: ["스프링"],
  TypeScript: ["ts", "타입스크립트"],
};

const ALIAS_TARGETS = new Map(
  Object.entries(SKILL_ALIASES).flatMap(([canonicalName, aliases]) =>
    aliases.map((alias) => [skillNameKey(alias), canonicalName] as const),
  ),
);

function suggestionRank(value: string, query: string) {
  if (value === query) return 0;
  if (value.startsWith(query)) return 1;
  if (value.split(/[\s./+#-]+/).some((part) => part.startsWith(query))) {
    return 2;
  }
  return value.includes(query) ? 3 : Number.POSITIVE_INFINITY;
}

function itemRank(item: SkillCatalogItem, query: string) {
  const searchableValues = [
    skillNameKey(item.name),
    ...(SKILL_ALIASES[item.name] ?? []).map(skillNameKey),
  ];
  return Math.min(...searchableValues.map((value) => suggestionRank(value, query)));
}

export function filterSkillSuggestions(
  catalog: readonly SkillCatalogItem[],
  value: string,
  excludedSkills: readonly string[],
  limit = MAX_SUGGESTIONS,
) {
  const query = skillNameKey(value);
  if (!query) return [];

  const excluded = new Set(excludedSkills.map(skillNameKey));
  return catalog
    .map((item) => ({ item, rank: itemRank(item, query) }))
    .filter(
      ({ item, rank }) =>
        !excluded.has(skillNameKey(item.name)) && Number.isFinite(rank),
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.item.name.localeCompare(right.item.name, "ko"),
    )
    .slice(0, Math.max(0, limit))
    .map(({ item }) => item);
}

export function resolveSkillInput(
  value: string,
  catalog: readonly SkillCatalogItem[],
) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = skillNameKey(trimmed);
  const aliasTarget = ALIAS_TARGETS.get(normalized);
  if (aliasTarget) {
    return (
      catalog.find(
        (item) => skillNameKey(item.name) === skillNameKey(aliasTarget),
      )?.name ?? aliasTarget
    );
  }

  return canonicalSkillName(trimmed, [...catalog]);
}

function catalogHint(status: CatalogStatus) {
  if (status === "loading") return "기술 목록을 불러오는 중입니다.";
  if (status === "ready") {
    return "기술명을 검색하거나 목록에 없으면 직접 추가할 수 있습니다.";
  }
  if (status === "error") {
    return "추천 목록을 불러오지 못했습니다. 기술명은 직접 추가할 수 있습니다.";
  }
  return "기술명을 입력하면 표준 기술명을 추천합니다.";
}

export function SkillPicker({
  catalog,
  catalogStatus,
  error = "",
  excludedSkills,
  id,
  onCommit,
  onValueChange,
  value,
}: SkillPickerProps) {
  const generatedId = useId().replace(/:/g, "");
  const listboxId = `${id}-${generatedId}-results`;
  const helperId = `${id}-${generatedId}-helper`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = value.trim();
  const suggestions = useMemo(
    () => filterSkillSuggestions(catalog, value, excludedSkills),
    [catalog, excludedSkills, value],
  );
  const resolvedInput = resolveSkillInput(value, catalog);
  const hasExactCatalogMatch = catalog.some(
    (item) => skillNameKey(item.name) === skillNameKey(resolvedInput),
  );
  const rows = useMemo<PickerRow[]>(() => {
    const nextRows: PickerRow[] = suggestions.map((skill) => ({
      kind: "catalog",
      skill,
    }));
    if (query && !hasExactCatalogMatch) {
      nextRows.push({ kind: "direct", value: query });
    }
    return nextRows;
  }, [hasExactCatalogMatch, query, suggestions]);
  const resultsVisible = open && query.length > 0 && rows.length > 0;

  function closeResults() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function commit(valueToCommit: string) {
    const resolved = resolveSkillInput(valueToCommit, catalog);
    if (!resolved) return false;
    const committed = onCommit(resolved);
    if (committed === false) return false;
    closeResults();
    inputRef.current?.focus();
    return true;
  }

  function commitRow(row: PickerRow) {
    return commit(row.kind === "catalog" ? row.skill.name : row.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commit(value);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && resultsVisible) {
      event.preventDefault();
      event.stopPropagation();
      closeResults();
      return;
    }
    if (event.key === "Tab") {
      closeResults();
      return;
    }
    if (rows.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % rows.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? rows.length - 1 : current - 1,
      );
      return;
    }
    if (event.key === "Enter" && resultsVisible && activeIndex >= 0) {
      event.preventDefault();
      commitRow(rows[activeIndex]);
    }
  }

  function handleRowPointerDown(
    event: ReactPointerEvent<HTMLLIElement>,
    row: PickerRow,
  ) {
    event.preventDefault();
    commitRow(row);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor={id}>
        추가할 기술
      </label>
      <div className={styles.controlRow}>
        <div className={styles.combobox}>
          <input
            aria-activedescendant={
              resultsVisible && activeIndex >= 0
                ? `${listboxId}-option-${activeIndex}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls={resultsVisible ? listboxId : undefined}
            aria-describedby={helperId}
            aria-expanded={resultsVisible}
            aria-invalid={Boolean(error)}
            autoComplete="off"
            className={styles.input}
            id={id}
            onBlur={closeResults}
            onChange={(event) => {
              onValueChange(event.target.value);
              setOpen(Boolean(event.target.value.trim()));
              setActiveIndex(-1);
            }}
            onFocus={() => setOpen(Boolean(query))}
            onKeyDown={handleKeyDown}
            placeholder="예: React, k8s"
            ref={inputRef}
            role="combobox"
            type="text"
            value={value}
          />
          {resultsVisible && (
            <ul
              aria-label="기술 검색 결과"
              className={styles.results}
              id={listboxId}
              role="listbox"
            >
              {rows.map((row, index) => {
                const optionId = `${listboxId}-option-${index}`;
                if (row.kind === "direct") {
                  return (
                    <li
                      aria-label={`“${row.value}” 직접 추가`}
                      aria-selected={activeIndex === index}
                      className={styles.directOption}
                      data-active={activeIndex === index ? "true" : undefined}
                      id={optionId}
                      key={`direct-${row.value}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onPointerDown={(event) => handleRowPointerDown(event, row)}
                      role="option"
                    >
                      <strong>“{row.value}” 직접 추가</strong>
                      <span>목록에 없음</span>
                    </li>
                  );
                }

                const category = skillCategoryLabel(
                  normalizeSkillCategory(row.skill.category),
                );
                return (
                  <li
                    aria-label={`${row.skill.name} ${category}`}
                    aria-selected={activeIndex === index}
                    data-active={activeIndex === index ? "true" : undefined}
                    id={optionId}
                    key={row.skill.name}
                    onMouseEnter={() => setActiveIndex(index)}
                    onPointerDown={(event) => handleRowPointerDown(event, row)}
                    role="option"
                  >
                    <strong>{row.skill.name}</strong>
                    <span>{category}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button className={styles.addButton} type="submit">
          <Plus aria-hidden="true" size={16} weight="bold" />
          추가
        </button>
      </div>
      <p
        className={error ? styles.error : styles.helper}
        id={helperId}
        role={error ? "alert" : undefined}
      >
        {error || catalogHint(catalogStatus)}
      </p>
      <span aria-live="polite" className={styles.srOnly}>
        {resultsVisible
          ? `표준 기술 ${suggestions.length.toLocaleString("ko-KR")}개 검색됨`
          : ""}
      </span>
    </form>
  );
}

