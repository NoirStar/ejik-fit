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
      {showWordmark && <span className="brand-lockup__ink">이직</span>}
      <span className="brand-lockup__accent">핏</span>
    </span>
  );
}
