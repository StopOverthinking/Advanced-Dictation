import { formatSetLabel } from "../data";
import type { VocabularyCardEntry } from "../types";

type VocabularyGridProps = {
  entries: VocabularyCardEntry[];
};

export function VocabularyGrid({ entries }: VocabularyGridProps) {
  if (entries.length === 0) {
    return (
      <main className="grid">
        <div className="empty">검색 결과가 없습니다.</div>
      </main>
    );
  }

  return (
    <main className="grid">
      {entries.map((entry) => (
        <article
          key={`${entry.setName}-${entry.word}`}
          className="card"
          aria-label={`${entry.word} ${formatSetLabel(entry.setName)}`}
        >
          <div className="card-top">
            <h2 className="word">{entry.word}</h2>
            <div className="set-tag">{formatSetLabel(entry.setName)}</div>
          </div>
          <p className="definition">{entry.definition}</p>
          <div className="example-block">
            <p className="example">{entry.example}</p>
          </div>
        </article>
      ))}
    </main>
  );
}
