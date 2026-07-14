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
  Wrench,
  type Icon,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import {
  siAndroid,
  siApachekafka,
  siApple,
  siC,
  siCplusplus,
  siDocker,
  siFigma,
  siGo,
  siGooglecloud,
  siJira,
  siKotlin,
  siKubernetes,
  siLinux,
  siMongodb,
  siMysql,
  siNodedotjs,
  siOpenjdk,
  siPostgresql,
  siPython,
  siPytorch,
  siReact,
  siRedis,
  siSpring,
  siTypescript,
  siUnity,
  type SimpleIcon,
} from "simple-icons";

import styles from "./technology-icon.module.css";

type BrandIcon = {
  icon: SimpleIcon;
  key: string;
};

const BRAND_ICONS: Record<string, BrandIcon> = {
  android: { icon: siAndroid, key: "android" },
  c: { icon: siC, key: "c" },
  "c++": { icon: siCplusplus, key: "cplusplus" },
  docker: { icon: siDocker, key: "docker" },
  figma: { icon: siFigma, key: "figma" },
  gcp: { icon: siGooglecloud, key: "googlecloud" },
  go: { icon: siGo, key: "go" },
  golang: { icon: siGo, key: "go" },
  ios: { icon: siApple, key: "apple" },
  java: { icon: siOpenjdk, key: "openjdk" },
  jira: { icon: siJira, key: "jira" },
  kafka: { icon: siApachekafka, key: "apachekafka" },
  kotlin: { icon: siKotlin, key: "kotlin" },
  kubernetes: { icon: siKubernetes, key: "kubernetes" },
  linux: { icon: siLinux, key: "linux" },
  mongodb: { icon: siMongodb, key: "mongodb" },
  mysql: { icon: siMysql, key: "mysql" },
  "node.js": { icon: siNodedotjs, key: "nodedotjs" },
  nodejs: { icon: siNodedotjs, key: "nodedotjs" },
  openjdk: { icon: siOpenjdk, key: "openjdk" },
  postgresql: { icon: siPostgresql, key: "postgresql" },
  python: { icon: siPython, key: "python" },
  pytorch: { icon: siPytorch, key: "pytorch" },
  react: { icon: siReact, key: "react" },
  redis: { icon: siRedis, key: "redis" },
  spring: { icon: siSpring, key: "spring" },
  "spring boot": { icon: siSpring, key: "spring" },
  typescript: { icon: siTypescript, key: "typescript" },
  unity: { icon: siUnity, key: "unity" },
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
  tool: { icon: Wrench, key: "wrench" },
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
  const brand = BRAND_ICONS[normalized];

  if (brand) {
    return (
      <span
        aria-hidden="true"
        className={styles.icon}
        data-icon-kind="brand"
        data-technology-icon={brand.key}
        style={{
          "--technology-icon-size": `${size}px`,
          color: `#${brand.icon.hex}`,
        } as CSSProperties}
      >
        <svg role="presentation" viewBox="0 0 24 24">
          <path d={brand.icon.path} fill="currentColor" />
        </svg>
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
