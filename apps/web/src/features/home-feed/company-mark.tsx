"use client";

import { useEffect, useRef, useState } from "react";

import { companyIdentity } from "./company-identity";
import styles from "./company-mark.module.css";

type CompanyMarkProps = {
  companyName: string;
  priority?: boolean;
  sourceUrl?: string;
  size?: number;
};

export function CompanyMark({
  companyName,
  priority = false,
  sourceUrl,
  size = 44,
}: CompanyMarkProps) {
  const identity = companyIdentity(companyName, sourceUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const showLogo =
    identity.kind === "logo" && Boolean(identity.src) && failedSrc !== identity.src;

  useEffect(() => {
    const image = imageRef.current;
    if (
      showLogo &&
      image?.complete &&
      image.naturalWidth === 0
    ) {
      setFailedSrc(identity.src ?? null);
    }
  }, [identity.src, showLogo]);

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
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          onError={() => setFailedSrc(identity.src ?? null)}
          ref={imageRef}
          src={identity.src}
        />
      ) : (
        identity.initials
      )}
    </span>
  );
}
