type SourceMetaProps = {
  sourceUrl: string;
  lastVerifiedAt: string;
  showSourceLink?: boolean;
};


function formatVerifiedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "확인 시각 미상";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}


export function SourceMeta({
  sourceUrl,
  lastVerifiedAt,
  showSourceLink = true,
}: SourceMetaProps) {
  return (
    <div className="source-meta">
      <span>마지막 확인 {formatVerifiedAt(lastVerifiedAt)}</span>
      {showSourceLink && (
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          공식 공고 열기
          <span aria-hidden="true"> ↗</span>
        </a>
      )}
    </div>
  );
}
