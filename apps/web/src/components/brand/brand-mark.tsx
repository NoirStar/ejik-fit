import Image from "next/image";


type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};


export function BrandMark({
  size = "md",
  showWordmark = true,
  className = "",
}: BrandMarkProps) {
  return (
    <span className={`brand-lockup brand-lockup--${size} ${className}`.trim()}>
      <Image
        alt=""
        aria-hidden="true"
        className="brand-lockup__mark"
        height={44}
        priority
        src="/brand/ejikfit-mark.svg"
        width={44}
      />
      {showWordmark && (
        <span className="brand-lockup__copy">
          <strong>이직핏</strong>
          <small>EJIK FIT</small>
        </span>
      )}
    </span>
  );
}
