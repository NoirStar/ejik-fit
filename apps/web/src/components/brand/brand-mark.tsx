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
    <span
      aria-hidden="true"
      className={`brand-lockup brand-lockup--${size} ${className}`.trim()}
    >
      <span className="brand-lockup__mark">
        <Image
          alt=""
          height={30}
          priority
          src="/brand/ejik-fit-mascot.png"
          width={30}
        />
      </span>
      {showWordmark && <span className="brand-lockup__wordmark">커리어핏</span>}
    </span>
  );
}
