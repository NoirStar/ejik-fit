import type { MarketSignal } from "./types";


type MiniMarketSignalsProps = {
  trendingSkills: MarketSignal[];
  cooccurringSkills: MarketSignal[];
};


function SignalColumn({
  title,
  signals,
}: {
  title: string;
  signals: MarketSignal[];
}) {
  return (
    <article className="market-signal-card">
      <h2>{title}</h2>
      <ul>
        {signals.map((signal) => (
          <li key={`${title}-${signal.label}`}>
            <strong>{signal.label}</strong>
            <span>{signal.value}</span>
            <small>{signal.caption}</small>
          </li>
        ))}
        {signals.length === 0 && <li>충분한 신호를 수집하는 중입니다.</li>}
      </ul>
    </article>
  );
}


export function MiniMarketSignals({
  trendingSkills,
  cooccurringSkills,
}: MiniMarketSignalsProps) {
  return (
    <section className="market-signals" id="signals" aria-label="시장 미니 신호">
      <SignalColumn title="급상승 기술" signals={trendingSkills} />
      <SignalColumn title="함께 요구" signals={cooccurringSkills} />
    </section>
  );
}
