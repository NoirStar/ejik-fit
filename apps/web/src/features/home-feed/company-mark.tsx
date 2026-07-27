"use client";

import { useEffect, useRef, useState } from "react";

import { companyIdentity } from "./company-identity";
import styles from "./company-mark.module.css";

type CompanyMarkProps = {
  companyName: string;
  companySlug?: string;
  priority?: boolean;
  sourceUrl?: string;
  size?: number;
};

export function hasEnoughLogoPixels({
  naturalWidth,
  naturalHeight,
  boxSize,
  devicePixelRatio,
}: {
  naturalWidth: number;
  naturalHeight: number;
  boxSize: number;
  devicePixelRatio: number;
}) {
  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    !Number.isFinite(boxSize) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    boxSize <= 0
  ) {
    return false;
  }
  const ratio = naturalWidth / naturalHeight;
  const drawnWidth = ratio >= 1 ? boxSize : boxSize * ratio;
  const drawnHeight = ratio >= 1 ? boxSize / ratio : boxSize;
  const scale = Math.min(
    Math.max(Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1, 1),
    2,
  );
  return (
    naturalWidth >= drawnWidth * scale && naturalHeight >= drawnHeight * scale
  );
}

export function CompanyMark({
  companyName,
  companySlug,
  priority = false,
  sourceUrl,
  size = 44,
}: CompanyMarkProps) {
  const identity = companyIdentity(companyName, sourceUrl, companySlug);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const showLogo =
    identity.kind === "logo" && Boolean(identity.src) && failedSrc !== identity.src;

  useEffect(() => {
    const image = imageRef.current;
    if (!showLogo || !image?.complete) return;
    if (
      !hasEnoughLogoPixels({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        boxSize: size * 0.76,
        devicePixelRatio: window.devicePixelRatio,
      })
    ) {
      setFailedSrc(identity.src ?? null);
    }
  }, [identity.src, showLogo, size]);

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
          onLoad={(event) => {
            if (
              !hasEnoughLogoPixels({
                naturalWidth: event.currentTarget.naturalWidth,
                naturalHeight: event.currentTarget.naturalHeight,
                boxSize: size * 0.76,
                devicePixelRatio: window.devicePixelRatio,
              })
            ) {
              setFailedSrc(identity.src ?? null);
            }
          }}
          ref={imageRef}
          src={identity.src}
        />
      ) : (
        identity.initials
      )}
    </span>
  );
}
