import { formatSetLabel } from "../data";

type SetFilterBarProps = {
  isVisible: boolean;
  selectedSet: string;
  setNames: string[];
  onSelect: (setName: string) => void;
};

export function SetFilterBar({
  isVisible,
  selectedSet,
  setNames,
  onSelect,
}: SetFilterBarProps) {
  return (
    <section className={`filters ${isVisible ? "" : "is-hidden"}`}>
      <div className="filter-row" role="tablist" aria-label="세트 선택">
        {["all", ...setNames].map((setName) => {
          const isActive = selectedSet === setName;

          return (
            <button
              key={setName}
              className={`chip ${isActive ? "active" : ""}`}
              type="button"
              onClick={() => {
                onSelect(setName);
              }}
            >
              {formatSetLabel(setName)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
