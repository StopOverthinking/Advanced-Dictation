type SearchBarProps = {
  query: string;
  countLabel: string;
  onChange: (value: string) => void;
};

export function SearchBar({ query, countLabel, onChange }: SearchBarProps) {
  return (
    <div className="search-wrap">
      <input
        className="search"
        type="search"
        value={query}
        placeholder="단어, 뜻, 예문 검색"
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <div className="count" aria-live="polite">
        {countLabel}
      </div>
    </div>
  );
}
