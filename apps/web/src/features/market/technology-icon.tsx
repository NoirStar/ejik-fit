import {
  Bug,
  Circuitry,
  Cloud,
  Code,
  Cpu,
  Database,
  DeviceMobile,
  GameController,
  HardDrives,
  Network,
  ShieldCheck,
  Stack,
  type Icon,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";

import { resolveTechnologyBrandAsset } from "./technology-icon-assets";
import styles from "./technology-icon.module.css";

const LOCAL_LOGOS: Record<string, { key: string; src: string }> = {
  aws: { key: "aws", src: "/technology-logos/aws.svg" },
};

const CONCEPT_ICONS: Record<string, { icon: Icon; key: string }> = {
  llm: { icon: Cpu, key: "cpu" },
  rag: { icon: Network, key: "network" },
  "model serving": { icon: HardDrives, key: "server" },
  sql: { icon: Database, key: "database" },
};

const CATEGORY_ICONS: Record<string, { icon: Icon; key: string }> = {
  ai: { icon: Cpu, key: "cpu" },
  backend: { icon: HardDrives, key: "server" },
  data: { icon: Database, key: "database" },
  design: { icon: Stack, key: "stack" },
  embedded: { icon: Circuitry, key: "circuitry" },
  frontend: { icon: Code, key: "code" },
  game: { icon: GameController, key: "game-controller" },
  infra: { icon: Cloud, key: "cloud" },
  language: { icon: Code, key: "code" },
  mobile: { icon: DeviceMobile, key: "mobile" },
  qa: { icon: Bug, key: "bug" },
  robotics: { icon: Circuitry, key: "circuitry" },
  security: { icon: ShieldCheck, key: "shield" },
};

function normalizeTechnologyName(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

export function TechnologyIcon({
  category,
  name,
  size = 24,
}: {
  category: string;
  name: string;
  size?: number;
}) {
  const normalized = normalizeTechnologyName(name);
  const localLogo = LOCAL_LOGOS[normalized];

  if (localLogo) {
    return (
      <span
        aria-hidden="true"
        className={styles.icon}
        data-icon-kind="brand"
        data-technology-icon={localLogo.key}
        style={{ "--technology-icon-size": `${size}px` } as CSSProperties}
      >
        <img alt="" src={localLogo.src} />
      </span>
    );
  }

  const brand = resolveTechnologyBrandAsset(name);

  if (brand) {
    return (
      <span
        aria-hidden="true"
        className={styles.icon}
        data-icon-kind="brand"
        data-technology-icon={brand.key}
        style={{ "--technology-icon-size": `${size}px` } as CSSProperties}
      >
        <img alt="" src={brand.src} />
      </span>
    );
  }

  const neutral = CONCEPT_ICONS[normalized] ?? CATEGORY_ICONS[category] ?? {
    icon: Code,
    key: "code",
  };
  const NeutralIcon = neutral.icon;

  return (
    <span
      aria-hidden="true"
      className={styles.icon}
      data-icon-kind="neutral"
      data-technology-icon={neutral.key}
      style={{ "--technology-icon-size": `${size}px` } as CSSProperties}
    >
      <NeutralIcon aria-hidden="true" weight="duotone" />
    </span>
  );
}
