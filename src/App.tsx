import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import advancedDictationResultsJson from "./generated/advanced-dictation-results.json";
import studentAccountsJson from "./generated/student-accounts.json";
import {
  formatSetLabel,
  getDictationProblemsForSet,
  totalEntryCount,
  totalSetCount,
  vocabularyEntries,
  vocabularySets,
} from "./data";
import { SearchBar } from "./components/SearchBar";
import { SetFilterBar } from "./components/SetFilterBar";
import { VocabularyGrid } from "./components/VocabularyGrid";
import { useFilterBarVisibility } from "./hooks/useFilterBarVisibility";
import type { TeacherResultsBundle, TeacherResultSession } from "./types";

type RouteName = "home" | "vocab" | "answers" | "scores";
type SessionDraft = Record<number, number[]>;
type DraftState = Record<string, SessionDraft>;
type SavedSessionMap = Record<string, TeacherResultSession>;
type StudentAccount = {
  number: number;
  name: string;
  password: string;
};
type AdvancedDictationScoreValue = number | string | null | undefined;
type AdvancedDictationStudentScores = {
  name: string;
  results?: Record<string, AdvancedDictationScoreValue>;
  rounds?: Record<string, AdvancedDictationScoreValue>;
};
type AdvancedDictationResultsBundle = {
  scoreScale: number;
  defaultStatus: string;
  defaultStatusByRound: Record<string, string>;
  statusHelp: Record<string, string>;
  students: Record<string, AdvancedDictationStudentScores>;
};
type AdvancedDictationScoreRound = {
  roundNumber: number;
  label: string;
  displayValue: string;
} & (
  | {
      kind: "score";
      score: number;
    }
  | {
      kind: "status";
      status: string;
    }
);

const STUDENT_ACCOUNTS = studentAccountsJson as StudentAccount[];
const STUDENT_ACCOUNT_MAP = Object.fromEntries(
  STUDENT_ACCOUNTS.map((student) => [student.number, student]),
) as Record<number, StudentAccount>;
const STUDENT_NUMBERS = STUDENT_ACCOUNTS.map((student) => student.number);
const ADVANCED_DICTATION_RESULTS = advancedDictationResultsJson as AdvancedDictationResultsBundle;
const TEACHER_PASSWORD = "8805";
const TEACHER_ACCESS_STORAGE_KEY = "advanced-dictation-teacher-access";
const ADVANCED_DICTATION_ROUND_COUNT = 11;
const ADVANCED_DICTATION_STATUS_ORDER = ["미실시", "미제출", "확인 불가"];
const scoreNumberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 1,
});

function getStudentAccount(studentNumber: number) {
  return STUDENT_ACCOUNT_MAP[studentNumber];
}

function formatStudentLabel(studentNumber: number) {
  const student = getStudentAccount(studentNumber);
  return student ? `${studentNumber}번 ${student.name}` : `${studentNumber}번`;
}

function formatScoreNumber(value: number) {
  return scoreNumberFormatter.format(value);
}

function normalizeAdvancedDictationValue(value: AdvancedDictationScoreValue): AdvancedDictationScoreRound {
  const scoreScale =
    Number(ADVANCED_DICTATION_RESULTS.scoreScale) > 0
      ? Number(ADVANCED_DICTATION_RESULTS.scoreScale)
      : 10;
  const defaultStatus = ADVANCED_DICTATION_RESULTS.defaultStatus || "미실시";

  if (typeof value === "number" && Number.isFinite(value)) {
    const score = Math.max(0, Math.min(scoreScale, Math.round(value * 2) / 2));

    return {
      kind: "score",
      roundNumber: 0,
      label: "",
      score,
      displayValue: `${formatScoreNumber(score)}점`,
    };
  }

  const text = value === null || value === undefined ? "" : String(value).trim();
  const numericValue = Number(text);

  if (text && !Number.isNaN(numericValue)) {
    const score = Math.max(0, Math.min(scoreScale, Math.round(numericValue * 2) / 2));

    return {
      kind: "score",
      roundNumber: 0,
      label: "",
      score,
      displayValue: `${formatScoreNumber(score)}점`,
    };
  }

  const status = text || defaultStatus;

  return {
    kind: "status",
    roundNumber: 0,
    label: "",
    status,
    displayValue: status,
  };
}

function getAdvancedDictationStudentData(studentNumber: number) {
  return ADVANCED_DICTATION_RESULTS.students[String(studentNumber)] ?? null;
}

function getAdvancedDictationRounds(studentNumber: number): AdvancedDictationScoreRound[] {
  const studentData = getAdvancedDictationStudentData(studentNumber);
  const roundSource = studentData?.results ?? studentData?.rounds ?? {};

  return Array.from({ length: ADVANCED_DICTATION_ROUND_COUNT }, (_, index) => {
    const roundNumber = index + 1;
    const rawValue =
      roundSource[roundNumber] ??
      roundSource[String(roundNumber)] ??
      ADVANCED_DICTATION_RESULTS.defaultStatusByRound[String(roundNumber)] ??
      ADVANCED_DICTATION_RESULTS.defaultStatusByRound[roundNumber] ??
      ADVANCED_DICTATION_RESULTS.defaultStatus;
    const normalized = normalizeAdvancedDictationValue(rawValue);

    return {
      ...normalized,
      roundNumber,
      label: `${roundNumber}회`,
    };
  });
}

function getAdvancedDictationStatusClass(status: string) {
  if (status === "미제출") {
    return "is-not-submitted";
  }

  if (status === "확인 불가") {
    return "is-unavailable";
  }

  return "is-not-started";
}

function getRoundAriaLabel(rounds: AdvancedDictationScoreRound[]) {
  return rounds.map((round) => `${round.label} ${round.displayValue}`).join(", ");
}

function matchesQuery(query: string, value: string) {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function getRouteFromHash(): RouteName {
  const hash = window.location.hash.replace(/^#\/?/, "");

  if (hash === "vocab") {
    return "vocab";
  }

  if (hash === "answers") {
    return "answers";
  }

  if (hash === "scores" || hash === "teacher") {
    return "scores";
  }

  return "home";
}

function getHashForRoute(route: RouteName) {
  return route === "home" ? "#/" : `#/${route}`;
}

function createEmptyDraft(problemCount: number) {
  const problemNumbers = Array.from({ length: problemCount }, (_, index) => index + 1);
  const draft = {} as SessionDraft;

  for (const studentNumber of STUDENT_NUMBERS) {
    draft[studentNumber] = problemNumbers.filter(() => false);
  }

  return draft;
}

function formatDateTime(value: string) {
  if (!value) {
    return "없음";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildTeacherSession(setName: string, draft: SessionDraft): TeacherResultSession {
  const problems = getDictationProblemsForSet(setName);
  const problemCount = problems.length;

  return {
    setName,
    setNumber: problems[0]?.setNumber ?? (Number(setName.replace("set", "")) || 0),
    label: formatSetLabel(setName),
    problemCount,
    problems,
    studentResults: STUDENT_NUMBERS.map((studentNumber) => {
      const missedProblemNumbers = [...(draft[studentNumber] ?? [])].sort((left, right) => left - right);
      const wrongCount = missedProblemNumbers.length;
      const correctCount = Math.max(problemCount - wrongCount, 0);
      const accuracy = problemCount
        ? Number(((correctCount / problemCount) * 100).toFixed(1))
        : 0;

      return {
        studentNumber,
        missedProblemNumbers,
        wrongCount,
        correctCount,
        accuracy,
      };
    }),
  };
}

function downloadResultsBundle(bundle: TeacherResultsBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `teacher-results-${bundle.exportedAt.slice(0, 10) || "export"}.json`;
  link.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function MenuButton({
  title,
  description,
  href,
  onNavigate,
}: {
  title: string;
  description: string;
  href: string;
  onNavigate?: () => void;
}) {
  return (
    <a
      className="menu-orb"
      href={href}
      onClick={(event) => {
        if (!onNavigate) {
          return;
        }

        event.preventDefault();
        onNavigate();
      }}
    >
      <span className="menu-orb-title">{title}</span>
      <span className="menu-orb-copy">{description}</span>
    </a>
  );
}

function HomeMenu({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  return (
    <main className="home-shell">
      <section className="menu-hero">
        <p className="eyebrow">Advanced Dictation</p>
        <h1>시작</h1>
      </section>

      <section className="menu-grid" aria-label="메인 메뉴">
        <MenuButton
          title="단어장"
          description="11세트"
          href="#/vocab"
          onNavigate={() => {
            onNavigate("vocab");
          }}
        />
        <MenuButton
          title="8주차"
          description="받아쓰기 정답"
          href="#/answers"
          onNavigate={() => {
            onNavigate("answers");
          }}
        />
        <MenuButton
          title="성적 확인"
          description="비밀번호로 결과 보기"
          href="#/scores"
          onNavigate={() => {
            onNavigate("scores");
          }}
        />
      </section>
    </main>
  );
}

function RouteBackButton({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  return (
    <a
      className="shape-button back-button"
      href="#/"
      onClick={(event) => {
        event.preventDefault();
        onNavigate("home");
      }}
    >
      메뉴로
    </a>
  );
}

function TeacherAccessGate({
  onNavigate,
  onUnlock,
}: {
  onNavigate: (route: RouteName) => void;
  onUnlock: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password === TEACHER_PASSWORD) {
      setError("");
      onUnlock();
      return;
    }

    setError("비밀번호가 맞지 않습니다.");
  }

  return (
    <div className="shell">
      <section className="hero hero-subpage">
        <div className="hero-top">
          <div className="hero-copy">
            <h1>교사용</h1>
            <RouteBackButton onNavigate={onNavigate} />
          </div>
        </div>
      </section>

      <section className="panel access-panel">
        <form className="password-form" onSubmit={handleSubmit}>
          <label className="password-label" htmlFor="teacher-password">
            비밀번호
          </label>
          <input
            id="teacher-password"
            className="password-input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) {
                setError("");
              }
            }}
          />
          {error ? <p className="form-error">{error}</p> : null}
          <button className="shape-button button-accent" type="submit">
            들어가기
          </button>
        </form>
      </section>
    </div>
  );
}

function VocabularyPage({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  const [selectedSet, setSelectedSet] = useState("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const isFilterBarVisible = useFilterBarVisibility();

  const filteredEntries = vocabularyEntries.filter((entry) => {
    const matchesSet = selectedSet === "all" || entry.setName === selectedSet;
    if (!matchesSet) {
      return false;
    }

    if (!deferredQuery) {
      return true;
    }

    return [entry.word, entry.definition, entry.example].some((field) =>
      matchesQuery(deferredQuery, field),
    );
  });

  return (
    <div className="shell">
      <section className="hero hero-subpage">
        <div className="hero-top">
          <div className="hero-copy">
            <h1>단어장</h1>
            <RouteBackButton onNavigate={onNavigate} />
          </div>
          <div className="meta" aria-label="요약 정보">
            <span>세트 {totalSetCount}</span>
            <span>단어 {totalEntryCount}</span>
          </div>
        </div>

        <SearchBar
          query={query}
          countLabel={`${filteredEntries.length} / ${totalEntryCount}`}
          onChange={setQuery}
        />
      </section>

      <SetFilterBar
        isVisible={isFilterBarVisible}
        selectedSet={selectedSet}
        setNames={vocabularySets.map(([setName]) => setName)}
        onSelect={setSelectedSet}
      />

      <VocabularyGrid entries={filteredEntries} />
    </div>
  );
}

function TeacherPage({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  const [selectedSet, setSelectedSet] = useState(vocabularySets[0]?.[0] ?? "set1");
  const [drafts, setDrafts] = useState<DraftState>({});
  const [savedSessions, setSavedSessions] = useState<SavedSessionMap>({});
  const problems = getDictationProblemsForSet(selectedSet);
  const problemCount = problems.length;
  const currentDraft = drafts[selectedSet] ?? createEmptyDraft(problemCount);
  const savedSessionList = Object.values(savedSessions).sort(
    (left, right) => left.setNumber - right.setNumber,
  );

  function updateStudentProblem(studentNumber: number, problemNumber: number, checked: boolean) {
    setDrafts((previous) => {
      const previousDraft = previous[selectedSet] ?? createEmptyDraft(problemCount);
      const currentProblems = previousDraft[studentNumber] ?? [];
      const nextProblems = checked
        ? [...new Set([...currentProblems, problemNumber])].sort((left, right) => left - right)
        : currentProblems.filter((value) => value !== problemNumber);

      return {
        ...previous,
        [selectedSet]: {
          ...previousDraft,
          [studentNumber]: nextProblems,
        },
      };
    });
  }

  function resetCurrentDraft() {
    setDrafts((previous) => ({
      ...previous,
      [selectedSet]: createEmptyDraft(problemCount),
    }));
  }

  function saveCurrentSession() {
    setSavedSessions((previous) => ({
      ...previous,
      [selectedSet]: buildTeacherSession(selectedSet, currentDraft),
    }));
  }

  function removeSavedSession(setName: string) {
    setSavedSessions((previous) => {
      const nextSessions = { ...previous };
      delete nextSessions[setName];
      return nextSessions;
    });
  }

  function exportSavedSessions() {
    if (savedSessionList.length === 0) {
      return;
    }

    downloadResultsBundle({
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: savedSessionList,
    });
  }

  return (
    <div className="shell">
      <section className="hero hero-subpage">
        <div className="hero-top">
          <div className="hero-copy">
            <h1>교사용</h1>
            <RouteBackButton onNavigate={onNavigate} />
          </div>
          <div className="meta" aria-label="교사용 요약">
            <span>회차 {totalSetCount}</span>
            <span>학생 21명</span>
          </div>
        </div>
      </section>

      <section className="panel set-panel">
        <div className="panel-head">
          <h2>회차 선택</h2>
        </div>
        <div className="filter-row" role="tablist" aria-label="회차 선택">
          {vocabularySets.map(([setName]) => {
            const isActive = setName === selectedSet;

            return (
              <button
                key={setName}
                className={`chip ${isActive ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setSelectedSet(setName);
                }}
              >
                {formatSetLabel(setName)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="teacher-top-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>문제 생성</h2>
            <span className="panel-note">dictation 기준, 단어장 순서와 다르게 고정 섞기</span>
          </div>
          <div className="question-list">
            {problems.map((problem) => (
              <article key={`${problem.setName}-${problem.number}`} className="question-item">
                <div className="question-head">
                  <span className="question-number">문제 {String(problem.number).padStart(2, "0")}</span>
                  <span className="source-pill">원본 {String(problem.sourceIndex).padStart(2, "0")}</span>
                </div>
                <p className="question-dictation">{problem.dictation}</p>
                <p className="question-answer">{problem.word}</p>
              </article>
            ))}
          </div>
        </section>

      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>채점기</h2>
          <span className="panel-note">{formatSetLabel(selectedSet)} 오답 체크</span>
        </div>

        <div className="table-wrap">
          <table className="grader-table">
            <thead>
              <tr>
                <th>학생</th>
                {problems.map((problem) => (
                  <th key={problem.number}>{problem.number}</th>
                ))}
                <th>오답 수</th>
              </tr>
            </thead>
            <tbody>
              {STUDENT_NUMBERS.map((studentNumber) => {
                const missedProblems = currentDraft[studentNumber] ?? [];
                const student = getStudentAccount(studentNumber);

                return (
                  <tr key={studentNumber}>
                    <th scope="row">
                      <span className="student-row-number">{studentNumber}번</span>
                      <span className="student-row-name">{student?.name ?? ""}</span>
                    </th>
                    {problems.map((problem) => {
                      const checked = missedProblems.includes(problem.number);

                      return (
                        <td key={`${studentNumber}-${problem.number}`}>
                          <input
                            className="grader-check"
                            type="checkbox"
                            checked={checked}
                            aria-label={`${studentNumber}번 학생 ${problem.number}번 문제 오답`}
                            onChange={(event) => {
                              updateStudentProblem(
                                studentNumber,
                                problem.number,
                                event.target.checked,
                              );
                            }}
                          />
                        </td>
                      );
                    })}
                    <td className="wrong-count-cell">{missedProblems.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>채점 기록 내보내기</h2>
          <span className="panel-note">저장한 회차만 JSON으로 묶어 다운로드합니다.</span>
        </div>

        <div className="button-row">
          <button className="shape-button button-reset" type="button" onClick={saveCurrentSession}>
            현재 회차 저장
          </button>
          <button className="shape-button button-muted" type="button" onClick={resetCurrentDraft}>
            현재 회차 초기화
          </button>
          <button
            className="shape-button button-accent"
            type="button"
            disabled={savedSessionList.length === 0}
            onClick={exportSavedSessions}
          >
            JSON 다운로드
          </button>
        </div>

        <div className="saved-session-list">
          {savedSessionList.length === 0 ? (
            <div className="empty-panel">저장된 회차가 아직 없습니다.</div>
          ) : (
            savedSessionList.map((session) => {
              const averageAccuracy = session.studentResults.length
                ? (
                    session.studentResults.reduce(
                      (total, result) => total + result.accuracy,
                      0,
                    ) / session.studentResults.length
                  ).toFixed(1)
                : "0.0";

              return (
                <article key={session.setName} className="saved-session-item">
                  <div>
                    <strong>{session.label}</strong>
                    <p>{session.problemCount}문항 · 평균 정확도 {averageAccuracy}%</p>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => {
                      removeSavedSession(session.setName);
                    }}
                  >
                    삭제
                  </button>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function ScoreTrendChart({ rounds }: { rounds: AdvancedDictationScoreRound[] }) {
  const svgWidth = 780;
  const svgHeight = 280;
  const paddingLeft = 42;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 54;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const baselineY = paddingTop + chartHeight;
  const scoreScale =
    Number(ADVANCED_DICTATION_RESULTS.scoreScale) > 0
      ? Number(ADVANCED_DICTATION_RESULTS.scoreScale)
      : 10;
  const stepX = rounds.length > 1 ? chartWidth / (rounds.length - 1) : 0;
  const scoreTicks = Array.from({ length: scoreScale + 1 }, (_, index) => index).filter(
    (value) => value === 0 || value === scoreScale || value % 2 === 0,
  );
  const points: Array<AdvancedDictationScoreRound & { x: number; y: number }> = rounds.map(
    (round, index) => {
      const x = paddingLeft + stepX * index;
      const y =
        round.kind === "score"
          ? paddingTop + ((scoreScale - round.score) / scoreScale) * chartHeight
          : baselineY;

      return {
        ...round,
        x,
        y,
      };
    },
  );
  const pathSegments: Array<typeof points> = [];
  let currentSegment: typeof points = [];

  points.forEach((point) => {
    if (point.kind === "score") {
      currentSegment.push(point);
      return;
    }

    if (currentSegment.length > 1) {
      pathSegments.push(currentSegment);
    }

    currentSegment = [];
  });

  if (currentSegment.length > 1) {
    pathSegments.push(currentSegment);
  }

  return (
    <section className="dictation-chart-panel" aria-label="심화 받아쓰기 성적 그래프">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label={getRoundAriaLabel(rounds)}>
        {scoreTicks.map((tick) => {
          const y = paddingTop + ((scoreScale - tick) / scoreScale) * chartHeight;

          return (
            <g key={`tick-${tick}`}>
              <line
                className="dictation-grid-line"
                x1={paddingLeft}
                y1={y}
                x2={svgWidth - paddingRight}
                y2={y}
              />
              <text className="dictation-axis-label" x={paddingLeft - 10} y={y + 4} textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}

        {points.map((point) => (
          <g key={`column-${point.roundNumber}`}>
            <line
              className="dictation-grid-column"
              x1={point.x}
              y1={paddingTop}
              x2={point.x}
              y2={baselineY}
            />
            <text className="dictation-axis-label" x={point.x} y={svgHeight - 14} textAnchor="middle">
              {point.label}
            </text>
          </g>
        ))}

        <line
          className="dictation-baseline"
          x1={paddingLeft}
          y1={baselineY}
          x2={svgWidth - paddingRight}
          y2={baselineY}
        />

        {pathSegments.map((segment, index) => {
          const path = segment
            .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");

          return <path key={`line-${index}`} className="dictation-line" d={path} />;
        })}

        {points
          .filter((point) => point.kind === "score")
          .map((point) => (
            <g key={`score-${point.roundNumber}`}>
              <circle className="dictation-score-point" cx={point.x} cy={point.y} r="5" />
              <text className="dictation-score-label" x={point.x} y={point.y - 12} textAnchor="middle">
                {formatScoreNumber(point.score)}
              </text>
            </g>
          ))}

        {points
          .filter((point) => point.kind === "status")
          .map((point) => (
            <circle
              key={`status-${point.roundNumber}`}
              className={`dictation-status-point ${getAdvancedDictationStatusClass(point.status)}`}
              cx={point.x}
              cy={baselineY}
              r="6"
            />
          ))}
      </svg>
    </section>
  );
}

function ScoresPage({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  const [password, setPassword] = useState("");
  const [authenticatedStudentNumber, setAuthenticatedStudentNumber] = useState<number | null>(null);
  const [error, setError] = useState("");
  const authenticatedStudent = authenticatedStudentNumber
    ? getStudentAccount(authenticatedStudentNumber)
    : null;
  const rounds = authenticatedStudent ? getAdvancedDictationRounds(authenticatedStudent.number) : [];
  const scoreRounds = rounds.filter((round) => round.kind === "score");
  const averageScore = scoreRounds.length
    ? scoreRounds.reduce((total, round) => total + round.score, 0) / scoreRounds.length
    : 0;
  let latestRound = rounds[rounds.length - 1];

  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    if (rounds[index].kind === "score") {
      latestRound = rounds[index];
      break;
    }
  }
  const statusHelpEntries = ADVANCED_DICTATION_STATUS_ORDER.filter((status) =>
    Boolean(ADVANCED_DICTATION_RESULTS.statusHelp[status]),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const student = STUDENT_ACCOUNTS.find((candidate) => candidate.password === password.trim());

    if (!student) {
      setError("비밀번호를 다시 확인해 주세요.");
      return;
    }

    setAuthenticatedStudentNumber(student.number);
    setPassword("");
    setError("");
  }

  function handleLogout() {
    setAuthenticatedStudentNumber(null);
    setPassword("");
    setError("");
  }

  return (
    <div className="shell">
      <section className="hero hero-subpage">
        <div className="hero-top">
          <div className="hero-copy">
            <h1>성적 확인</h1>
            <RouteBackButton onNavigate={onNavigate} />
            {authenticatedStudent ? <p className="subcopy">{authenticatedStudent.name}</p> : null}
          </div>
          <div className="meta" aria-label="성적 확인 요약">
            <span>회차 {ADVANCED_DICTATION_ROUND_COUNT}</span>
            <span>{ADVANCED_DICTATION_RESULTS.scoreScale}점 만점</span>
          </div>
        </div>
      </section>

      {!authenticatedStudent ? (
        <section className="panel access-panel">
          <form className="password-form" onSubmit={handleSubmit}>
            <label className="password-label" htmlFor="student-password">
              비밀번호
            </label>
            <input
              id="student-password"
              className="password-input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) {
                  setError("");
                }
              }}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <button className="shape-button button-accent" type="submit">
              성적 확인
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span className="stat-value">{scoreRounds.length}</span>
              <span className="stat-label">점수 입력 회차</span>
            </article>
            <article className="stat-card">
              <span className="stat-value">
                {scoreRounds.length ? `${formatScoreNumber(averageScore)}점` : "-"}
              </span>
              <span className="stat-label">평균 점수</span>
            </article>
            <article className="stat-card">
              <span className="stat-value">{latestRound?.displayValue ?? "-"}</span>
              <span className="stat-label">최근 결과</span>
            </article>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>내 성적</h2>
              <button className="shape-button button-muted" type="button" onClick={handleLogout}>
                다른 비밀번호 입력
              </button>
            </div>

            <div className="student-summary-grid">
              <article className="problem-stat">
                <strong>학생</strong>
                <span>{formatStudentLabel(authenticatedStudent.number)}</span>
                <em>로그인 완료</em>
              </article>
              <article className="problem-stat">
                <strong>입력된 점수</strong>
                <span>{scoreRounds.length}회</span>
                <em>미실시와 미제출 제외</em>
              </article>
              <article className="problem-stat">
                <strong>기준</strong>
                <span>{ADVANCED_DICTATION_RESULTS.scoreScale}점 만점</span>
                <em>0.5점 단위</em>
              </article>
            </div>
          </section>

          <section className="panel advanced-score-panel">
            <div className="panel-head">
              <h2>심화 받아쓰기 결과</h2>
            </div>

            <div className="dictation-status-help">
              <div className="dictation-status-note-list">
                {statusHelpEntries.map((status) => (
                  <article key={status} className="dictation-status-item">
                    <span className="dictation-status-pill">{status}</span>
                    <p>{ADVANCED_DICTATION_RESULTS.statusHelp[status]}</p>
                  </article>
                ))}
              </div>
            </div>

            <ScoreTrendChart rounds={rounds} />

            <div className="dictation-score-grid" aria-label="회차별 심화 받아쓰기 성적">
              {rounds.map((round) => (
                <article
                  key={round.roundNumber}
                  className={`dictation-round-card ${
                    round.kind === "score" ? "is-score" : getAdvancedDictationStatusClass(round.status)
                  }`}
                >
                  <p className="dictation-round-label">{round.label}</p>
                  <p className="dictation-round-value">{round.displayValue}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AnswersPage({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  const answers = getDictationProblemsForSet("set8");

  return (
    <div className="shell">
      <section className="hero hero-subpage">
        <div className="hero-top">
          <div className="hero-copy">
            <h1>8주차</h1>
            <RouteBackButton onNavigate={onNavigate} />
            <p className="subcopy">8주차 받아쓰기</p>
          </div>
          <div className="meta" aria-label="8주차 정답 요약">
            <span>문항 {answers.length}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>정답</h2>
        </div>
        <div className="answer-list">
          {answers.map((problem) => (
            <article key={problem.number} className="answer-item">
              <span className="answer-number">{problem.number}</span>
              <strong className="answer-text">{problem.dictation}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<RouteName>(() => getRouteFromHash());

  function navigate(routeName: RouteName) {
    setRoute(routeName);
    window.location.hash = getHashForRoute(routeName);
  }

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRouteFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  if (route === "vocab") {
    return <VocabularyPage onNavigate={navigate} />;
  }

  if (route === "answers") {
    return <AnswersPage onNavigate={navigate} />;
  }

  if (route === "scores") {
    return <ScoresPage onNavigate={navigate} />;
  }

  return <HomeMenu onNavigate={navigate} />;
}
