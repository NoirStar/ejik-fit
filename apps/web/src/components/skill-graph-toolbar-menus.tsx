"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { SkillPicker } from "@/features/owned-skills/skill-picker";
import { PRODUCT_TERMS } from "@/lib/labels";
import { MAX_OWNED_SKILLS } from "@/lib/owned-skills";
import type { SkillGraphViewDomain } from "@/lib/skill-graph-view";
import type {
  SkillGraphLabelDensity,
  SkillGraphRelationshipDensity,
} from "@/lib/skill-graph-visibility";
import type { SkillCatalogItem } from "@/lib/types";

import styles from "./skill-graph-atlas.module.css";


type ToolbarMenuId = "owned" | "domains" | "display" | "legend";


type OwnedMenuProps = {
  catalog: readonly SkillCatalogItem[];
  input: string;
  onCommit(value: string): boolean | void;
  onInputChange(value: string): void;
  onRemove(skill: string): void;
  skills: readonly string[];
};


type DomainMenuProps = {
  domains: readonly SkillGraphViewDomain[];
  formatLabel(domain: string): string;
  onClear(): void;
  onToggle(domain: string): void;
  resultCount: number;
  selected: readonly string[];
  summary: string;
};


type DisplayMenuProps = {
  labelDensity: SkillGraphLabelDensity;
  onLabelDensityChange(value: SkillGraphLabelDensity): void;
  onRelationshipDensityChange(value: SkillGraphRelationshipDensity): void;
  relationshipDensity: SkillGraphRelationshipDensity;
  relationshipLabels: Record<SkillGraphRelationshipDensity, string>;
};


type SkillGraphToolbarMenusProps = {
  display: DisplayMenuProps;
  domains: DomainMenuProps;
  owned: OwnedMenuProps;
};


type ToolbarMenuProps = {
  children: ReactNode;
  id: ToolbarMenuId;
  label: ReactNode;
  onToggle(id: ToolbarMenuId): void;
  open: boolean;
  panelClassName?: string;
  panelLabel: string;
  triggerLabel: string;
  triggerRef(node: HTMLButtonElement | null): void;
};


function ToolbarMenu({
  children,
  id,
  label,
  onToggle,
  open,
  panelClassName = styles.popover,
  panelLabel,
  triggerLabel,
  triggerRef,
}: ToolbarMenuProps) {
  const panelId = `skill-graph-${id}-menu`;
  return (
    <div className={styles.toolbarMenu} data-open={open ? "true" : undefined}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        className={styles.toolbarMenuTrigger}
        onClick={() => onToggle(id)}
        ref={triggerRef}
        type="button"
      >
        {label}
      </button>
      {open && (
        <div
          aria-label={panelLabel}
          className={panelClassName}
          id={panelId}
          role="dialog"
        >
          {children}
        </div>
      )}
    </div>
  );
}


export function SkillGraphToolbarMenus({
  display,
  domains,
  owned,
}: SkillGraphToolbarMenusProps) {
  const [openMenu, setOpenMenu] = useState<ToolbarMenuId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Partial<Record<ToolbarMenuId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!openMenu) return;

    function closeFromOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpenMenu(null);
      }
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape" || !openMenu) return;
      event.preventDefault();
      const activeMenu = openMenu;
      setOpenMenu(null);
      window.requestAnimationFrame(() => triggerRefs.current[activeMenu]?.focus());
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [openMenu]);

  function toggleMenu(id: ToolbarMenuId) {
    setOpenMenu((current) => (current === id ? null : id));
  }

  function triggerRef(id: ToolbarMenuId) {
    return (node: HTMLButtonElement | null) => {
      triggerRefs.current[id] = node;
    };
  }

  return (
    <div className={styles.toolbarMenus} ref={rootRef}>
      <ToolbarMenu
        id="owned"
        label={<>내 기술 <b>{owned.skills.length}</b></>}
        onToggle={toggleMenu}
        open={openMenu === "owned"}
        panelLabel="내 기술 관리"
        triggerLabel={`내 기술 ${owned.skills.length}`}
        triggerRef={triggerRef("owned")}
      >
        <div className={styles.popoverHeader}>
          <div>
            <strong>{PRODUCT_TERMS.ownedSkills}</strong>
            <span>추천과 공고 매칭에 반영됩니다.</span>
          </div>
          <b>{owned.skills.length}/{MAX_OWNED_SKILLS}</b>
        </div>
        <SkillPicker
          catalog={owned.catalog}
          catalogStatus="ready"
          excludedSkills={owned.skills}
          id="skill-graph-owned-skill"
          onCommit={owned.onCommit}
          onValueChange={owned.onInputChange}
          value={owned.input}
        />
        {owned.skills.length > 0 ? (
          <div className={styles.skillChips}>
            {owned.skills.map((skill) => (
              <span key={skill}>
                {skill}
                <button
                  aria-label={`${skill} 제거`}
                  onClick={() => owned.onRemove(skill)}
                  type="button"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.emptyCopy}>아직 추가한 기술이 없습니다.</p>
        )}
      </ToolbarMenu>

      <ToolbarMenu
        id="domains"
        label={<>분야 <b>{domains.summary}</b></>}
        onToggle={toggleMenu}
        open={openMenu === "domains"}
        panelLabel="분야 필터"
        triggerLabel={`분야 ${domains.summary}`}
        triggerRef={triggerRef("domains")}
      >
        <div className={styles.popoverHeader}>
          <div>
            <strong>분야 필터</strong>
            <span>한 분야를 고르거나 여러 분야를 비교해 보세요.</span>
          </div>
          <b aria-atomic="true" aria-live="polite" role="status">
            현재 {domains.resultCount}개 기술 표시
          </b>
        </div>
        <div className={styles.domainFilters}>
          <button
            aria-pressed={domains.selected.length === 0}
            data-active={domains.selected.length === 0 ? "true" : undefined}
            onClick={domains.onClear}
            type="button"
          >
            <i aria-hidden="true" data-kind="all" />
            <span>전체</span>
            <b>{domains.domains.reduce((sum, domain) => sum + domain.count, 0)}</b>
          </button>
          {domains.domains.map((group) => {
            const selected = domains.selected.includes(group.domain);
            return (
              <button
                aria-pressed={selected}
                data-active={selected ? "true" : undefined}
                key={group.domain}
                onClick={() => domains.onToggle(group.domain)}
                type="button"
              >
                <i aria-hidden="true" style={{ backgroundColor: group.color }} />
                <span>{domains.formatLabel(group.domain)}</span>
                <b>{group.count}</b>
              </button>
            );
          })}
          {domains.domains.length === 0 && (
            <p className={styles.emptyCopy}>확인 가능한 분야가 없습니다.</p>
          )}
        </div>
      </ToolbarMenu>

      <ToolbarMenu
        id="display"
        label={
          <>
            보기 설정 <b>{display.relationshipLabels[display.relationshipDensity]}</b>
          </>
        }
        onToggle={toggleMenu}
        open={openMenu === "display"}
        panelClassName={`${styles.popover} ${styles.displayPopover}`}
        panelLabel="그래프 보기 설정"
        triggerLabel={`보기 설정 ${display.relationshipLabels[display.relationshipDensity]}`}
        triggerRef={triggerRef("display")}
      >
        <div className={styles.popoverHeader}>
          <div>
            <strong>그래프 표시</strong>
            <span>배치는 유지하고 표시 정보만 바뀝니다.</span>
          </div>
        </div>
        <div className={styles.displaySetting}>
          <span id="skill-graph-relationship-density">관계선</span>
          <div
            aria-labelledby="skill-graph-relationship-density"
            className={styles.settingSegmented}
            role="group"
          >
            {(
              Object.entries(display.relationshipLabels) as [
                SkillGraphRelationshipDensity,
                string,
              ][]
            ).map(([value, label]) => (
              <button
                aria-pressed={display.relationshipDensity === value}
                data-active={
                  display.relationshipDensity === value ? "true" : undefined
                }
                key={value}
                onClick={() => display.onRelationshipDensityChange(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.displaySetting}>
          <span id="skill-graph-label-density">기술명</span>
          <div
            aria-labelledby="skill-graph-label-density"
            className={styles.settingSegmented}
            role="group"
          >
            <button
              aria-pressed={display.labelDensity === "key"}
              data-active={display.labelDensity === "key" ? "true" : undefined}
              onClick={() => display.onLabelDensityChange("key")}
              type="button"
            >
              주요만
            </button>
            <button
              aria-pressed={display.labelDensity === "more"}
              data-active={display.labelDensity === "more" ? "true" : undefined}
              onClick={() => display.onLabelDensityChange("more")}
              type="button"
            >
              더 많이
            </button>
          </div>
        </div>
      </ToolbarMenu>

      <ToolbarMenu
        id="legend"
        label="읽는 법"
        onToggle={toggleMenu}
        open={openMenu === "legend"}
        panelClassName={styles.legend}
        panelLabel="스킬맵 읽는 법"
        triggerLabel="읽는 법"
        triggerRef={triggerRef("legend")}
      >
        <p aria-label="스킬맵 범례" role="note">
          <span><i aria-hidden="true" data-kind="demand" />크기: 시장 수요</span>
          <span><i aria-hidden="true" data-kind="domain" />색: 기술 분야</span>
          <span><i aria-hidden="true" data-kind="owned" />테두리: 내 기술</span>
          <span><i aria-hidden="true" data-kind="recommended" />점: 학습 추천</span>
          <span><i aria-hidden="true" data-kind="link" />선 농도: 함께 요구</span>
        </p>
      </ToolbarMenu>
    </div>
  );
}
