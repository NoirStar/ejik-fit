"use client";

import { useState } from "react";

import { companyIdentity } from "./company-identity";
import styles from "./company-mark.module.css";

type CompanyMarkProps = {
  companyName: string;
  sourceUrl?: string;
  size?: number;
};

export function CompanyMark({
  companyName,
  sourceUrl,
  size = 44,
}: CompanyMarkProps) {
  const identity = companyIdentity(companyName, sourceUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showLogo =
    identity.kind === "logo" && Boolean(identity.src) && failedSrc !== identity.src;

  return (
    <span
      aria-hidden="true"
      className={styles.mark}
      data-kind={showLogo ? "logo" : "initials"}
      data-surface={showLogo ? identity.surface : undefined}
      style={{ height: size, width: size }}
      title={identity.alt}
    >
      {showLogo ? (
        <img
          alt=""
          className={styles.logo}
          onError={() => setFailedSrc(identity.src ?? null)}
          src={identity.src}
        />
      ) : (
        identity.initials
      )}
    </span>
  );
}
