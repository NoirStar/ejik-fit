import Link from "next/link";

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
      <div className="daily-card-core market-signal-card__core">
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
      </div>
    </article>
  );
}


export function MiniMarketSignals({
  trendingSkills,
  cooccurringSkills,
}: MiniMarketSignalsProps) {
  return (
    <section className="market-signals" id="signals" aria-label="시장 미니 신호">
      <article className="market-signal-card market-signal-card--graph">
        <div className="daily-card-core market-signal-card__core">
          <header className="mini-graph__header">
            <div>
              <span>기술 맵 미리보기</span>
              <h2>내 스택 주변 신호</h2>
            </div>
            <Link href="/skills/graph">열기</Link>
          </header>
          <div className="mini-graph" aria-hidden="true">
            <span className="mini-graph__node mini-graph__node--core">Spring</span>
            <span className="mini-graph__node mini-graph__node--a">Java</span>
            <span className="mini-graph__node mini-graph__node--b">AWS</span>
            <span className="mini-graph__node mini-graph__node--c">Kubernetes</span>
            <span className="mini-graph__node mini-graph__node--d">Docker</span>
            <i className="mini-graph__line mini-graph__line--a" />
            <i className="mini-graph__line mini-graph__line--b" />
            <i className="mini-graph__line mini-graph__line--c" />
            <i className="mini-graph__line mini-graph__line--d" />
          </div>
        </div>
      </article>
      <SignalColumn title="급상승 기술" signals={trendingSkills} />
      <SignalColumn title="함께 요구" signals={cooccurringSkills} />
    </section>
  );
}
