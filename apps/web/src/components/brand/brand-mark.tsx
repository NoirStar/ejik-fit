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
      <img
        alt=""
        className="brand-lockup__asset"
        draggable="false"
        height={30}
        src={
          showWordmark
            ? "/brand/ejik-fit-wordmark.svg"
            : "/brand/ejik-fit-glyph.svg"
        }
        width={showWordmark ? 75 : 26}
      />
    </span>
  );
}
