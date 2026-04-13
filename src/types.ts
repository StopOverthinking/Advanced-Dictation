export type VocabularyEntry = {
  word: string;
  definition: string;
  example: string;
  dictation: string;
};

export type VocabularyData = Record<string, VocabularyEntry[]>;

export type VocabularyCardEntry = VocabularyEntry & {
  setName: string;
  setNumber: number;
};

export type DictationProblem = {
  number: number;
  word: string;
  dictation: string;
  setName: string;
  setNumber: number;
  sourceIndex: number;
};

export type StudentSessionResult = {
  studentNumber: number;
  missedProblemNumbers: number[];
  wrongCount: number;
  correctCount: number;
  accuracy: number;
};

export type TeacherResultSession = {
  setName: string;
  setNumber: number;
  label: string;
  problemCount: number;
  problems: DictationProblem[];
  studentResults: StudentSessionResult[];
};

export type TeacherResultsBundle = {
  version: number;
  exportedAt: string;
  sessions: TeacherResultSession[];
};
