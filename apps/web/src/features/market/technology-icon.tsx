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
  siApachecassandra,
  siApple,
  siArgo,
  siC,
  siCelery,
  siClickhouse,
  siCmake,
  siCplusplus,
  siDatabricks,
  siDatadog,
  siDocker,
  siDotnet,
  siFigma,
  siGradle,
  siGraphql,
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
  siJunit5,
  siKotlin,
  siKubernetes,
  siLinux,
  siMariadb,
  siMilvus,
  siMongodb,
  siMlflow,
  siMqtt,
  siMysql,
  siNvidia,
  siNodedotjs,
  siNumpy,
  siOnnx,
  siOpentelemetry,
  siOpenjdk,
  siOpensearch,
  siPostgresql,
  siPrometheus,
  siPython,
  siPandas,
  siPytest,
  siPytorch,
  siRabbitmq,
  siReact,
  siReactquery,
  siRedis,
  siRedux,
  siSentry,
  siSonarqubeserver,
  siSnowflake,
  siSpring,
  siStorybook,
  siTailwindcss,
  siTerraform,
  siTypescript,
  siUnity,
  siVite,
  siVllm,
  siVulkan,
  siWebrtc,
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
  "apache cassandra": { icon: siApachecassandra, key: "apachecassandra" },
  "argo cd": { icon: siArgo, key: "argo" },
  bash: { icon: siGnubash, key: "gnubash" },
  bigquery: { icon: siGooglebigquery, key: "googlebigquery" },
  c: { icon: siC, key: "c" },
  cassandra: { icon: siApachecassandra, key: "apachecassandra" },
  celery: { icon: siCelery, key: "celery" },
  "c++": { icon: siCplusplus, key: "cplusplus" },
  clickhouse: { icon: siClickhouse, key: "clickhouse" },
  cmake: { icon: siCmake, key: "cmake" },
  databricks: { icon: siDatabricks, key: "databricks" },
  datadog: { icon: siDatadog, key: "datadog" },
  docker: { icon: siDocker, key: "docker" },
  figma: { icon: siFigma, key: "figma" },
  gcp: { icon: siGooglecloud, key: "googlecloud" },
  go: { icon: siGo, key: "go" },
  golang: { icon: siGo, key: "go" },
  gradle: { icon: siGradle, key: "gradle" },
  grafana: { icon: siGrafana, key: "grafana" },
  graphql: { icon: siGraphql, key: "graphql" },
  "github actions": { icon: siGithubactions, key: "githubactions" },
  "gitlab ci": { icon: siGitlab, key: "gitlab" },
  helm: { icon: siHelm, key: "helm" },
  "hugging face": { icon: siHuggingface, key: "huggingface" },
  ios: { icon: siApple, key: "apple" },
  istio: { icon: siIstio, key: "istio" },
  "isaac sim": { icon: siNvidia, key: "nvidia" },
  java: { icon: siOpenjdk, key: "openjdk" },
  jira: { icon: siJira, key: "jira" },
  junit: { icon: siJunit5, key: "junit5" },
  jenkins: { icon: siJenkins, key: "jenkins" },
  kafka: { icon: siApachekafka, key: "apachekafka" },
  kotlin: { icon: siKotlin, key: "kotlin" },
  kubernetes: { icon: siKubernetes, key: "kubernetes" },
  linux: { icon: siLinux, key: "linux" },
  mariadb: { icon: siMariadb, key: "mariadb" },
  milvus: { icon: siMilvus, key: "milvus" },
  mongodb: { icon: siMongodb, key: "mongodb" },
  mlflow: { icon: siMlflow, key: "mlflow" },
  mqtt: { icon: siMqtt, key: "mqtt" },
  mysql: { icon: siMysql, key: "mysql" },
  numpy: { icon: siNumpy, key: "numpy" },
  "node.js": { icon: siNodedotjs, key: "nodedotjs" },
  nodejs: { icon: siNodedotjs, key: "nodedotjs" },
  openjdk: { icon: siOpenjdk, key: "openjdk" },
  onnx: { icon: siOnnx, key: "onnx" },
  opentelemetry: { icon: siOpentelemetry, key: "opentelemetry" },
  opensearch: { icon: siOpensearch, key: "opensearch" },
  postgresql: { icon: siPostgresql, key: "postgresql" },
  pandas: { icon: siPandas, key: "pandas" },
  python: { icon: siPython, key: "python" },
  pytest: { icon: siPytest, key: "pytest" },
  pytorch: { icon: siPytorch, key: "pytorch" },
  prometheus: { icon: siPrometheus, key: "prometheus" },
  rabbitmq: { icon: siRabbitmq, key: "rabbitmq" },
  react: { icon: siReact, key: "react" },
  "react native": { icon: siReact, key: "react" },
  "tanstack query": { icon: siReactquery, key: "reactquery" },
  redis: { icon: siRedis, key: "redis" },
  redux: { icon: siRedux, key: "redux" },
  sentry: { icon: siSentry, key: "sentry" },
  sonarqube: { icon: siSonarqubeserver, key: "sonarqubeserver" },
  snowflake: { icon: siSnowflake, key: "snowflake" },
  spring: { icon: siSpring, key: "spring" },
  "spring boot": { icon: siSpring, key: "spring" },
  storybook: { icon: siStorybook, key: "storybook" },
  "tailwind css": { icon: siTailwindcss, key: "tailwindcss" },
  tensorrt: { icon: siNvidia, key: "nvidia" },
  terraform: { icon: siTerraform, key: "terraform" },
  typescript: { icon: siTypescript, key: "typescript" },
  triton: { icon: siNvidia, key: "nvidia" },
  unity: { icon: siUnity, key: "unity" },
  vite: { icon: siVite, key: "vite" },
  vllm: { icon: siVllm, key: "vllm" },
  vulkan: { icon: siVulkan, key: "vulkan" },
  webrtc: { icon: siWebrtc, key: "webrtc" },
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
