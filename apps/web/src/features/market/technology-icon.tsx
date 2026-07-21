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
  siAnsible,
  siApacheairflow,
  siApacheflink,
  siApachehive,
  siApachekafka,
  siApachespark,
  siApple,
  siArgo,
  siC,
  siClickhouse,
  siCplusplus,
  siDatabricks,
  siDatadog,
  siDocker,
  siDotnet,
  siFigma,
  siGithubactions,
  siGitlab,
  siGnubash,
  siGo,
  siGooglebigquery,
  siGooglecloud,
  siGrafana,
  siHelm,
  siHuggingface,
  siIstio,
  siJenkins,
  siJira,
  siKotlin,
  siKubernetes,
  siLinux,
  siMongodb,
  siMlflow,
  siMysql,
  siNodedotjs,
  siOnnx,
  siOpenjdk,
  siOpensearch,
  siPostgresql,
  siPrometheus,
  siPython,
  siPytorch,
  siRabbitmq,
  siReact,
  siRedis,
  siSnowflake,
  siSpring,
  siTerraform,
  siTypescript,
  siUnity,
  siVite,
  siVllm,
  siWebpack,
  type SimpleIcon,
} from "simple-icons";

import styles from "./technology-icon.module.css";

type BrandIcon = {
  icon: SimpleIcon;
  key: string;
};

const LOCAL_LOGOS: Record<string, { key: string; src: string }> = {
  aws: { key: "aws", src: "/technology-logos/aws.svg" },
};

const BRAND_ICONS: Record<string, BrandIcon> = {
  ".net": { icon: siDotnet, key: "dotnet" },
  android: { icon: siAndroid, key: "android" },
  ansible: { icon: siAnsible, key: "ansible" },
  "apache airflow": { icon: siApacheairflow, key: "apacheairflow" },
  "apache flink": { icon: siApacheflink, key: "apacheflink" },
  "apache hive": { icon: siApachehive, key: "apachehive" },
  "apache spark": { icon: siApachespark, key: "apachespark" },
  "argo cd": { icon: siArgo, key: "argo" },
  bash: { icon: siGnubash, key: "gnubash" },
  bigquery: { icon: siGooglebigquery, key: "googlebigquery" },
  c: { icon: siC, key: "c" },
  "c++": { icon: siCplusplus, key: "cplusplus" },
  clickhouse: { icon: siClickhouse, key: "clickhouse" },
  databricks: { icon: siDatabricks, key: "databricks" },
  datadog: { icon: siDatadog, key: "datadog" },
  docker: { icon: siDocker, key: "docker" },
  figma: { icon: siFigma, key: "figma" },
  gcp: { icon: siGooglecloud, key: "googlecloud" },
  go: { icon: siGo, key: "go" },
  golang: { icon: siGo, key: "go" },
  grafana: { icon: siGrafana, key: "grafana" },
  "github actions": { icon: siGithubactions, key: "githubactions" },
  "gitlab ci": { icon: siGitlab, key: "gitlab" },
  helm: { icon: siHelm, key: "helm" },
  "hugging face": { icon: siHuggingface, key: "huggingface" },
  ios: { icon: siApple, key: "apple" },
  istio: { icon: siIstio, key: "istio" },
  java: { icon: siOpenjdk, key: "openjdk" },
  jira: { icon: siJira, key: "jira" },
  jenkins: { icon: siJenkins, key: "jenkins" },
  kafka: { icon: siApachekafka, key: "apachekafka" },
  kotlin: { icon: siKotlin, key: "kotlin" },
  kubernetes: { icon: siKubernetes, key: "kubernetes" },
  linux: { icon: siLinux, key: "linux" },
  mongodb: { icon: siMongodb, key: "mongodb" },
  mlflow: { icon: siMlflow, key: "mlflow" },
  mysql: { icon: siMysql, key: "mysql" },
  "node.js": { icon: siNodedotjs, key: "nodedotjs" },
  nodejs: { icon: siNodedotjs, key: "nodedotjs" },
  openjdk: { icon: siOpenjdk, key: "openjdk" },
  onnx: { icon: siOnnx, key: "onnx" },
  opensearch: { icon: siOpensearch, key: "opensearch" },
  postgresql: { icon: siPostgresql, key: "postgresql" },
  python: { icon: siPython, key: "python" },
  pytorch: { icon: siPytorch, key: "pytorch" },
  prometheus: { icon: siPrometheus, key: "prometheus" },
  rabbitmq: { icon: siRabbitmq, key: "rabbitmq" },
  react: { icon: siReact, key: "react" },
  "react native": { icon: siReact, key: "react" },
  redis: { icon: siRedis, key: "redis" },
  snowflake: { icon: siSnowflake, key: "snowflake" },
  spring: { icon: siSpring, key: "spring" },
  "spring boot": { icon: siSpring, key: "spring" },
  terraform: { icon: siTerraform, key: "terraform" },
  typescript: { icon: siTypescript, key: "typescript" },
  unity: { icon: siUnity, key: "unity" },
  vite: { icon: siVite, key: "vite" },
  vllm: { icon: siVllm, key: "vllm" },
  webpack: { icon: siWebpack, key: "webpack" },
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
  const localLogo = LOCAL_LOGOS[normalized];
  const brand = BRAND_ICONS[normalized];

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
