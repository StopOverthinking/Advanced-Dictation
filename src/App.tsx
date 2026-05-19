import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import teacherResultsJson from "./generated/teacher-results.json";
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

type RouteName = "home" | "vocab" | "answers" | "teacher";
type SessionDraft = Record<number, number[]>;
type DraftState = Record<string, SessionDraft>;
type SavedSessionMap = Record<string, TeacherResultSession>;
type StudentAccount = {
  number: number;
  name: string;
  password: string;
};

const STUDENT_ACCOUNTS: StudentAccount[] = [
  { number: 1, name: "고가민", password: "830291" },
  { number: 2, name: "곽다현", password: "050607" },
  { number: 3, name: "김희윤", password: "601141" },
  { number: 4, name: "류가윤", password: "141102" },
  { number: 5, name: "문지완", password: "140611" },
  { number: 6, name: "박소영", password: "034600" },
  { number: 7, name: "박연우", password: "140619" },
  { number: 8, name: "박세빈", password: "140721" },
  { number: 9, name: "박형우", password: "245844" },
  { number: 10, name: "성장호", password: "140318" },
  { number: 11, name: "송문주", password: "111213" },
  { number: 12, name: "이원진", password: "676767" },
  { number: 13, name: "이채린", password: "612807" },
  { number: 14, name: "이하설", password: "141015" },
  { number: 15, name: "전우수", password: "777567" },
  { number: 16, name: "주은유", password: "141106" },
  { number: 17, name: "지수현", password: "141125" },
  { number: 18, name: "최규진", password: "918273" },
  { number: 19, name: "최연준", password: "999999" },
  { number: 20, name: "최예서", password: "141029" },
  { number: 21, name: "홍석영", password: "140805" },
];
const STUDENT_ACCOUNT_MAP = Object.fromEntries(
  STUDENT_ACCOUNTS.map((student) => [student.number, student]),
) as Record<number, StudentAccount>;
const STUDENT_NUMBERS = STUDENT_ACCOUNTS.map((student) => student.number);
const STATIC_TEACHER_RESULTS = teacherResultsJson as TeacherResultsBundle;
const TEACHER_PASSWORD = "8805";
const TEACHER_ACCESS_STORAGE_KEY = "advanced-dictation-teacher-access";

function getStudentAccount(studentNumber: number) {
  return STUDENT_ACCOUNT_MAP[studentNumber];
}

function formatStudentLabel(studentNumber: number) {
  const student = getStudentAccount(studentNumber);
  return student ? `${studentNumber}번 ${student.name}` : `${studentNumber}번`;
}

function matchesQuery(query: string, value: string) {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function getRouteFromHash(): RouteName {
  const hash = window.location.hash.replace(/^#\/?/, "");

  if (hash === "vocab") {
    return "vocab";
  }

  if (hash === "answers" || hash === "scores") {
    return "answers";
  }

  if (hash === "teacher") {
    return "teacher";
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
          title="5주차"
          description="받아쓰기 정답"
          href="#/answers"
          onNavigate={() => {
            onNavigate("answers");
          }}
        />
        <MenuButton
          title="교사용"
          description="문제 생성 · 채점"
          href="#/teacher"
          onNavigate={() => {
            onNavigate("teacher");
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

function ScoresPage({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  const sessions = [...STATIC_TEACHER_RESULTS.sessions].sort(
    (left, right) => left.setNumber - right.setNumber,
  );
  const [studentNumber, setStudentNumber] = useState(STUDENT_ACCOUNTS[0]?.number ?? 1);
  const [password, setPassword] = useState("");
  const [authenticatedStudentNumber, setAuthenticatedStudentNumber] = useState<number | null>(null);
  const [error, setError] = useState("");
  const authenticatedStudent = authenticatedStudentNumber
    ? getStudentAccount(authenticatedStudentNumber)
    : null;
  const studentSessions = authenticatedStudent
    ? sessions
        .map((session) => {
          const result = session.studentResults.find(
            (item) => item.studentNumber === authenticatedStudent.number,
          );

          if (!result) {
            return null;
          }

          return {
            session,
            result,
            missedProblems: session.problems.filter((problem) =>
              result.missedProblemNumbers.includes(problem.number),
            ),
          };
        })
        .filter((entry) => entry !== null)
    : [];
  const totalCorrect = studentSessions.reduce((total, entry) => total + entry.result.correctCount, 0);
  const totalWrong = studentSessions.reduce((total, entry) => total + entry.result.wrongCount, 0);
  const totalQuestions = studentSessions.reduce(
    (total, entry) => total + entry.session.problemCount,
    0,
  );
  const overallAccuracy = totalQuestions
    ? Number(((totalCorrect / totalQuestions) * 100).toFixed(1))
    : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const student = getStudentAccount(studentNumber);

    if (!student || student.password !== password) {
      setError("이름이나 비밀번호를 다시 확인해 주세요.");
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
            <h1>결과 통계</h1>
            <RouteBackButton onNavigate={onNavigate} />
            {authenticatedStudent ? <p className="subcopy">{authenticatedStudent.name}</p> : null}
          </div>
          <div className="meta" aria-label="통계 요약">
            <span>회차 {sessions.length}</span>
            <span>업데이트 {formatDateTime(STATIC_TEACHER_RESULTS.exportedAt)}</span>
          </div>
        </div>
      </section>

      {sessions.length === 0 ? (
        <section className="panel">
          <div className="empty-panel empty-panel-large">
            <strong>아직 통계 데이터가 없습니다.</strong>
            <p>교사용 메뉴에서 JSON을 만든 뒤 `src/generated/teacher-results.json`으로 교체하고 빌드하면 이 화면이 채워집니다.</p>
          </div>
        </section>
      ) : !authenticatedStudent ? (
        <section className="panel access-panel">
          <form className="password-form" onSubmit={handleSubmit}>
            <label className="password-label" htmlFor="student-number">
              이름
            </label>
            <select
              id="student-number"
              className="student-select"
              value={studentNumber}
              onChange={(event) => {
                setStudentNumber(Number(event.target.value));
                if (error) {
                  setError("");
                }
              }}
            >
              {STUDENT_ACCOUNTS.map((student) => (
                <option key={student.number} value={student.number}>
                  {formatStudentLabel(student.number)}
                </option>
              ))}
            </select>

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
              내 결과 보기
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span className="stat-value">{studentSessions.length}</span>
              <span className="stat-label">응시 회차</span>
            </article>
            <article className="stat-card">
              <span className="stat-value">{overallAccuracy}%</span>
              <span className="stat-label">내 정확도</span>
            </article>
            <article className="stat-card">
              <span className="stat-value">{totalWrong}</span>
              <span className="stat-label">총 오답 수</span>
            </article>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>내 결과</h2>
              <button className="shape-button button-muted" type="button" onClick={handleLogout}>
                다른 학생으로 보기
              </button>
            </div>

            <div className="student-summary-grid">
              <article className="problem-stat">
                <strong>학생</strong>
                <span>{formatStudentLabel(authenticatedStudent.number)}</span>
                <em>로그인 완료</em>
              </article>
              <article className="problem-stat">
                <strong>맞은 개수</strong>
                <span>{totalCorrect}</span>
                <em>전체 누적</em>
              </article>
              <article className="problem-stat">
                <strong>틀린 개수</strong>
                <span>{totalWrong}</span>
                <em>전체 누적</em>
              </article>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>회차별 결과</h2>
            </div>
            <div className="session-grid">
              {studentSessions.map((entry) => {
                return (
                  <article key={entry.session.setName} className="session-card">
                    <div className="session-head">
                      <div>
                        <h3>{entry.session.label}</h3>
                        <p>{entry.session.problemCount}문항</p>
                      </div>
                      <div className="session-meta">
                        <span>정확도 {entry.result.accuracy}%</span>
                        <span>오답 {entry.result.wrongCount}</span>
                      </div>
                    </div>

                    {entry.missedProblems.length === 0 ? (
                      <div className="empty-panel">
                        <strong>모두 맞았습니다.</strong>
                      </div>
                    ) : (
                      <div className="problem-stat-grid">
                        {entry.missedProblems.map((problem) => (
                          <article
                            key={`${entry.session.setName}-${problem.number}`}
                            className="problem-stat"
                          >
                            <strong>Q{problem.number}</strong>
                            <span>{problem.word}</span>
                            <em>{problem.dictation}</em>
                          </article>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AnswersPage({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  const answers = getDictationProblemsForSet("set5");

  return (
    <div className="shell">
      <section className="hero hero-subpage">
        <div className="hero-top">
          <div className="hero-copy">
            <h1>5주차</h1>
            <RouteBackButton onNavigate={onNavigate} />
            <p className="subcopy">5주차 받아쓰기</p>
          </div>
          <div className="meta" aria-label="5주차 정답 요약">
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
  const [isTeacherUnlocked, setIsTeacherUnlocked] = useState(() => {
    return window.sessionStorage.getItem(TEACHER_ACCESS_STORAGE_KEY) === "granted";
  });

  function navigate(routeName: RouteName) {
    setRoute(routeName);
    window.location.hash = getHashForRoute(routeName);
  }

  function unlockTeacherAccess() {
    window.sessionStorage.setItem(TEACHER_ACCESS_STORAGE_KEY, "granted");
    setIsTeacherUnlocked(true);
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

  if (route === "teacher") {
    if (!isTeacherUnlocked) {
      return <TeacherAccessGate onNavigate={navigate} onUnlock={unlockTeacherAccess} />;
    }

    return <TeacherPage onNavigate={navigate} />;
  }

  return <HomeMenu onNavigate={navigate} />;
}
