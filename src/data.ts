import rawVocabularyData from "../vocabularies.txt?raw";
import type {
  DictationProblem,
  VocabularyCardEntry,
  VocabularyData,
} from "./types";

const MAX_WEB_SET = 11;

function toSetNumber(setName: string) {
  const parsed = Number(setName.replace("set", ""));
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function createSeed(value: string) {
  let seed = 0;

  for (let index = 0; index < value.length; index += 1) {
    seed = (seed * 31 + value.charCodeAt(index)) >>> 0;
  }

  return seed || 1;
}

function createRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleDeterministically<T>(items: T[], seedValue: string) {
  const random = createRandom(createSeed(seedValue));
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const remainedSame = shuffled.every((item, index) => item === items[index]);
  if (remainedSame && shuffled.length > 1) {
    shuffled.push(shuffled.shift()!);
  }

  return shuffled;
}

function normalizeData() {
  const parsed = JSON.parse(rawVocabularyData) as VocabularyData;

  return Object.entries(parsed)
    .filter(
      ([setName, items]) =>
        setName.startsWith("set") &&
        Array.isArray(items) &&
        toSetNumber(setName) <= MAX_WEB_SET,
    )
    .sort(([left], [right]) => toSetNumber(left) - toSetNumber(right));
}

export const vocabularySets = normalizeData();

export const vocabularyEntries: VocabularyCardEntry[] = vocabularySets.flatMap(
  ([setName, items]) =>
    items.map((item) => ({
      ...item,
      setName,
      setNumber: toSetNumber(setName),
    })),
);

export const totalSetCount = vocabularySets.length;
export const totalEntryCount = vocabularyEntries.length;

export function formatSetLabel(setName: string) {
  if (setName === "all") {
    return "전체";
  }

  const setNumber = toSetNumber(setName);
  return Number.isNaN(setNumber) ? setName : `SET ${String(setNumber).padStart(2, "0")}`;
}

export function getSetNumber(setName: string) {
  return toSetNumber(setName);
}

export function getDictationProblemsForSet(setName: string): DictationProblem[] {
  const matchedSet = vocabularySets.find(([name]) => name === setName);

  if (!matchedSet) {
    return [];
  }

  const [resolvedSetName, items] = matchedSet;
  const shuffledItems = shuffleDeterministically(
    items.map((item, index) => ({
      ...item,
      sourceIndex: index + 1,
    })),
    resolvedSetName,
  );

  return shuffledItems.map((item, index) => ({
    number: index + 1,
    word: item.word,
    dictation: item.dictation,
    setName: resolvedSetName,
    setNumber: toSetNumber(resolvedSetName),
    sourceIndex: item.sourceIndex,
  }));
}
