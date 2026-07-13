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

  return (
    <span
      aria-hidden="true"
      className={styles.mark}
      data-kind={identity.kind}
      style={{ height: size, width: size }}
      title={identity.alt}
    >
      {identity.kind === "logo" && identity.src ? (
        <img alt="" className={styles.logo} src={identity.src} />
      ) : (
        identity.initials
      )}
    </span>
  );
}
