from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "vocabularies.txt"
OUTPUT_DIR = ROOT / "output" / "web"
OUTPUT_HTML = OUTPUT_DIR / "index.html"
DOCS_DIR = ROOT / "docs"
DOCS_HTML = DOCS_DIR / "index.html"
MAX_SET = 11


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>단어장</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='24' fill='%231f5f5b'/%3E%3Cpath d='M27 24h28c7.18 0 13 5.82 13 13v35H40c-7.18 0-13-5.82-13-13V24Z' fill='%23fffaf3'/%3E%3Cpath d='M40 38h18M40 50h18M40 62h12' stroke='%231f5f5b' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E">
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&family=Noto+Serif+KR:wght@500;700&display=swap");

    :root {
      --bg: #f4f1ea;
      --panel: rgba(255, 255, 255, 0.86);
      --panel-strong: #fffdfa;
      --text: #1f2933;
      --muted: #5a6572;
      --line: rgba(31, 41, 51, 0.1);
      --accent: #1f5f5b;
      --accent-soft: #dcece7;
      --shadow: 0 18px 40px rgba(31, 41, 51, 0.08);
      --radius-lg: 24px;
      --radius-md: 18px;
      --radius-sm: 999px;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(31, 95, 91, 0.14), transparent 34%),
        radial-gradient(circle at top right, rgba(196, 144, 94, 0.12), transparent 28%),
        linear-gradient(180deg, #f8f6f1 0%, var(--bg) 100%);
      min-height: 100vh;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.32) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.32) 1px, transparent 1px);
      background-size: 36px 36px;
      mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent 86%);
      pointer-events: none;
    }

    .shell {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 56px;
      position: relative;
    }

    .hero {
      padding: 28px;
      border: 1px solid rgba(255, 255, 255, 0.68);
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(255, 253, 249, 0.8));
      backdrop-filter: blur(18px);
      box-shadow: var(--shadow);
      display: grid;
      gap: 18px;
    }

    .hero-top {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3.4rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
    }

    .meta {
      display: inline-flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .meta span {
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      background: rgba(31, 95, 91, 0.08);
      color: var(--accent);
      font-size: 0.95rem;
      font-weight: 700;
    }

    .search-wrap {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
    }

    .search {
      width: 100%;
      border: 0;
      outline: 0;
      padding: 16px 18px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.9);
      color: var(--text);
      font-size: 1rem;
      box-shadow: inset 0 0 0 1px rgba(31, 41, 51, 0.08);
    }

    .search::placeholder {
      color: #7a8694;
    }

    .count {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--muted);
      white-space: nowrap;
    }

    .filters {
      position: sticky;
      top: 18px;
      z-index: 10;
      margin-top: 18px;
      padding: 16px;
      border-radius: 20px;
      background: rgba(255, 253, 249, 0.82);
      backdrop-filter: blur(18px);
      border: 1px solid rgba(255, 255, 255, 0.7);
      box-shadow: 0 12px 24px rgba(31, 41, 51, 0.06);
      transform: translateY(0);
      opacity: 1;
      transition:
        transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 220ms ease,
        box-shadow 220ms ease;
      will-change: transform, opacity;
    }

    .filters.is-hidden {
      transform: translateY(calc(-100% - 18px));
      opacity: 0;
      box-shadow: 0 6px 12px rgba(31, 41, 51, 0.03);
      pointer-events: none;
    }

    .filter-row {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-bottom: 2px;
    }

    .filter-row::-webkit-scrollbar {
      display: none;
    }

    .chip {
      border: 0;
      padding: 11px 16px;
      border-radius: var(--radius-sm);
      background: rgba(31, 41, 51, 0.05);
      color: var(--muted);
      font: inherit;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 160ms ease, background 160ms ease, color 160ms ease;
      white-space: nowrap;
    }

    .chip:hover {
      transform: translateY(-1px);
    }

    .chip.active {
      background: var(--accent);
      color: #f7fbfa;
    }

    .grid {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .card {
      position: relative;
      overflow: hidden;
      padding: 18px 18px 16px;
      border-radius: var(--radius-md);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 253, 250, 0.84));
      border: 1px solid rgba(255, 255, 255, 0.85);
      box-shadow: var(--shadow);
      display: grid;
      gap: 10px;
      min-height: 204px;
    }

    .card::after {
      content: "";
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, #1f5f5b 0%, #d2a46d 100%);
      opacity: 0.95;
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: start;
    }

    .set-tag {
      flex: 0 0 auto;
      padding: 7px 10px;
      border-radius: 12px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .word {
      margin: 0;
      font-family: "Noto Serif KR", "Noto Serif Korean", serif;
      font-size: clamp(1.4rem, 2.2vw, 1.8rem);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.03em;
      word-break: keep-all;
    }

    .definition {
      margin: 0;
      font-family: "Nanum Gothic", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      font-size: 1.1rem;
      line-height: 1.72;
      color: var(--text);
      word-break: keep-all;
    }

    .example-block {
      margin-top: auto;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }

    .example {
      margin: 0;
      font-family: "Nanum Gothic", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      font-size: 1.04rem;
      line-height: 1.7;
      color: var(--muted);
      word-break: keep-all;
    }

    .empty {
      grid-column: 1 / -1;
      padding: 48px 20px;
      border-radius: var(--radius-md);
      text-align: center;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.88);
      color: var(--muted);
      font-weight: 700;
      box-shadow: var(--shadow);
    }

    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .shell {
        width: min(100vw - 20px, 100%);
        padding-top: 10px;
      }

      .hero {
        padding: 22px 18px;
      }

      .search-wrap {
        grid-template-columns: 1fr;
      }

      .filters {
        top: 10px;
        padding: 12px;
      }

      .card {
        padding: 16px 16px 14px;
        min-height: auto;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="hero-top">
        <h1>단어장</h1>
        <div class="meta">
          <span>세트 __SET_COUNT__</span>
          <span>단어 __TOTAL_COUNT__</span>
        </div>
      </div>
      <div class="search-wrap">
        <input id="searchInput" class="search" type="search" placeholder="단어, 뜻, 예문 검색" autocomplete="off">
        <div id="countLabel" class="count"></div>
      </div>
    </section>

    <section id="filtersBar" class="filters">
      <div id="filterRow" class="filter-row"></div>
    </section>

    <main id="cardGrid" class="grid"></main>
  </div>

  <script>
    const DATA = __DATA__;

    const entries = Object.entries(DATA).flatMap(([setName, items], setIndex) =>
      items.map((item, itemIndex) => ({
        ...item,
        setName,
        setIndex,
        itemIndex,
      }))
    );

    const state = {
      setName: "all",
      query: "",
    };

    const filterRow = document.getElementById("filterRow");
    const filtersBar = document.getElementById("filtersBar");
    const cardGrid = document.getElementById("cardGrid");
    const searchInput = document.getElementById("searchInput");
    const countLabel = document.getElementById("countLabel");

    const setKeys = Object.keys(DATA);
    const HIDE_SCROLL_DISTANCE = 26;
    const SHOW_SCROLL_DISTANCE = 72;
    const TOP_VISIBLE_RANGE = 140;

    let lastScrollY = window.scrollY;
    let downScrollAccum = 0;
    let upScrollAccum = 0;
    let filtersVisible = true;

    function formatSetLabel(setName) {
      if (setName === "all") {
        return "전체";
      }
      const number = Number(setName.replace("set", ""));
      return Number.isNaN(number) ? setName : `SET ${String(number).padStart(2, "0")}`;
    }

    function buildFilterButtons() {
      const names = ["all", ...setKeys];
      filterRow.innerHTML = names
        .map((name) => {
          const active = state.setName === name ? "active" : "";
          return `<button class="chip ${active}" type="button" data-set="${name}">${formatSetLabel(name)}</button>`;
        })
        .join("");

      filterRow.querySelectorAll("[data-set]").forEach((button) => {
        button.addEventListener("click", () => {
          state.setName = button.dataset.set;
          buildFilterButtons();
          render();
        });
      });
    }

    function setFiltersVisible(visible) {
      if (filtersVisible === visible) {
        return;
      }

      filtersVisible = visible;
      filtersBar.classList.toggle("is-hidden", !visible);
    }

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      if (currentScrollY <= TOP_VISIBLE_RANGE) {
        downScrollAccum = 0;
        upScrollAccum = 0;
        setFiltersVisible(true);
        lastScrollY = currentScrollY;
        return;
      }

      if (Math.abs(delta) < 2) {
        lastScrollY = currentScrollY;
        return;
      }

      if (delta > 0) {
        downScrollAccum += delta;
        upScrollAccum = 0;

        if (downScrollAccum >= HIDE_SCROLL_DISTANCE) {
          setFiltersVisible(false);
          downScrollAccum = 0;
        }
      } else {
        upScrollAccum += Math.abs(delta);
        downScrollAccum = 0;

        if (upScrollAccum >= SHOW_SCROLL_DISTANCE) {
          setFiltersVisible(true);
          upScrollAccum = 0;
        }
      }

      lastScrollY = currentScrollY;
    }

    function getFilteredEntries() {
      const query = state.query.trim().toLowerCase();

      return entries.filter((entry) => {
        const matchesSet = state.setName === "all" || entry.setName === state.setName;
        if (!matchesSet) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [entry.word, entry.definition, entry.example]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    function render() {
      const filtered = getFilteredEntries();
      countLabel.textContent = `${filtered.length} / ${entries.length}`;

      if (filtered.length === 0) {
        cardGrid.innerHTML = '<div class="empty">결과 없음</div>';
        return;
      }

      cardGrid.innerHTML = filtered
        .map((entry) => `
          <article class="card">
            <div class="card-top">
              <h2 class="word">${entry.word}</h2>
              <div class="set-tag">${formatSetLabel(entry.setName)}</div>
            </div>
            <p class="definition">${entry.definition}</p>
            <div class="example-block">
              <p class="example">${entry.example}</p>
            </div>
          </article>
        `)
        .join("");
    }

    searchInput.addEventListener("input", (event) => {
      state.query = event.target.value;
      render();
    });

    window.addEventListener("scroll", handleScroll, { passive: true });

    buildFilterButtons();
    render();
  </script>
</body>
</html>
"""


def main() -> None:
    raw_data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    data = {
        key: value
        for key, value in raw_data.items()
        if key.startswith("set") and key[3:].isdigit() and int(key[3:]) <= MAX_SET
    }
    output = (
        HTML_TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False))
        .replace("__SET_COUNT__", str(len(data)))
        .replace("__TOTAL_COUNT__", str(sum(len(items) for items in data.values())))
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_HTML.write_text(output, encoding="utf-8")
    DOCS_HTML.write_text(output, encoding="utf-8")
    print(f"Generated {OUTPUT_HTML}")
    print(f"Generated {DOCS_HTML}")


if __name__ == "__main__":
    main()
