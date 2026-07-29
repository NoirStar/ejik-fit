"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { filterSkillSuggestions } from "@/features/owned-skills/skill-picker";
import {
  normalizeSkillCategory,
  skillCategoryLabel,
} from "@/lib/skill-categories";
import type { SkillCatalogItem } from "@/lib/types";

import styles from "./skill-graph-search.module.css";


type SkillGraphSearchProps = {
  catalog: readonly SkillCatalogItem[];
  onSelect(skill: string): void;
  onValueChange(value: string): void;
  value: string;
};


export function SkillGraphSearch({
  catalog,
  onSelect,
  onValueChange,
  value,
}: SkillGraphSearchProps) {
  const generatedId = useId().replace(/:/g, "");
  const inputId = `skill-graph-search-${generatedId}`;
  const listboxId = `${inputId}-results`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(
    () => filterSkillSuggestions(catalog, value, [], 6),
    [catalog, value],
  );
  const resultsVisible = open && Boolean(value.trim()) && suggestions.length > 0;

  function closeResults() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function choose(skill: string, keepFocus = false) {
    onSelect(skill);
    onValueChange("");
    closeResults();
    if (keepFocus) inputRef.current?.focus();
    else inputRef.current?.blur();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeResults();
      return;
    }
    if (event.key === "Tab") {
      closeResults();
      return;
    }
    if (suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
      return;
    }
    if (event.key === "Enter" && resultsVisible && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]!.name, true);
    }
  }

  function keepInputFocused(event: MouseEvent<HTMLLIElement>) {
    event.preventDefault();
  }

  return (
    <div className={styles.root}>
      <label className={styles.label} htmlFor={inputId}>
        기술 찾기
      </label>
      <div className={styles.combobox}>
        <MagnifyingGlass aria-hidden="true" className={styles.icon} size={18} />
        <input
          aria-activedescendant={
            resultsVisible && activeIndex >= 0
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={resultsVisible ? listboxId : undefined}
          aria-expanded={resultsVisible}
          autoComplete="off"
          id={inputId}
          onBlur={closeResults}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(Boolean(event.target.value.trim()));
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(Boolean(value.trim()))}
          onKeyDown={handleKeyDown}
          placeholder="예: C++, Kubernetes"
          ref={inputRef}
          role="combobox"
          type="search"
          value={value}
        />
        {resultsVisible && (
          <ul
            aria-label="기술 검색 결과"
            className={styles.results}
            id={listboxId}
            role="listbox"
          >
            {suggestions.map((skill, index) => (
              <li
                aria-selected={activeIndex === index}
                data-active={activeIndex === index ? "true" : undefined}
                id={`${listboxId}-option-${index}`}
                key={skill.name}
                onClick={() => choose(skill.name)}
                onMouseDown={keepInputFocused}
                onMouseEnter={() => setActiveIndex(index)}
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
    </div>
  );
}
