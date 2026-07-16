const editorTableHead = document.querySelector("#editor-table-head");
const editorTableBody = document.querySelector("#editor-table-body");
const editorPreview = document.querySelector("#editor-preview");
const editorStatus = document.querySelector("#editor-status");
const editorStateBadge = document.querySelector("#editor-state-badge");
const editorStatusHelp = document.querySelector("#editor-status-help");
const loadFileButton = document.querySelector("#load-file-button");
const loadFileInput = document.querySelector("#load-file-input");
const saveFileButton = document.querySelector("#save-file-button");
const refreshPreviewButton = document.querySelector("#refresh-preview-button");

const roundNumbers = Array.from({ length: 11 }, (_, index) => index + 1);
const RESULT_JSON_PATH = "./src/generated/advanced-dictation-results.json";
const FILE_HANDLE_DB_NAME = "check-my-record-file-handles";
const FILE_HANDLE_STORE_NAME = "handles";
const LAST_SAVE_HANDLE_KEY = "advanced-dictation-last-save-handle";
const SAVE_PICKER_ID = "advanced-dictation-results";
const EDITOR_SNAPSHOT_KEY = "advanced-dictation-editor-snapshot-v1";
const ADVANCED_DICTATION_STATUS_ORDER = ["미실시", "미제출", "확인 불가"];
const ADVANCED_DICTATION_STATUS_HELP_DEFAULTS = {
  미실시: "아직 시험을 치르지 않음",
  미제출: "시험을 치렀으나 오답 고쳐쓰기 숙제를 완료하지 않음",
  "확인 불가": "시험을 치렀으나 시험지 분실 등으로 점수 확인 불가능",
};
const scoreOptions = [
  "미제출",
  "미실시",
  "확인 불가",
  ...Array.from({ length: 21 }, (_, index) => {
    const value = index * 0.5;
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }),
];

const appData = window.APP_DATA || {};
const bundledResultData = window.ADVANCED_DICTATION_EDITOR_DATA || null;
let advancedDictationData = {
  scoreScale: 10,
  defaultStatus: "미실시",
  defaultStatusByRound: {
    1: "미제출",
    11: "미실시",
  },
  statusHelp: ADVANCED_DICTATION_STATUS_HELP_DEFAULTS,
  students: {},
};
let advancedDictationStudents = advancedDictationData.students || {};
let defaultStatus = advancedDictationData.defaultStatus || "미실시";
let defaultStatusByRound = advancedDictationData.defaultStatusByRound || {
  1: "미제출",
  11: "미실시",
};
let isDirty = false;

function formatScoreValue(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isStatusValue(value) {
  return ADVANCED_DICTATION_STATUS_ORDER.includes(value);
}

function getStatusHelpText() {
  return {
    ...ADVANCED_DICTATION_STATUS_HELP_DEFAULTS,
    ...(advancedDictationData.statusHelp || {}),
  };
}

function getDictationStatusClass(value) {
  if (value === "미제출") {
    return "is-not-submitted";
  }

  if (value === "확인 불가") {
    return "is-unavailable";
  }

  return "is-not-started";
}

function renderStatusHelpNotes() {
  const statusHelpText = getStatusHelpText();

  editorStatusHelp.innerHTML = `
    <div class="dictation-status-note-list">
      ${ADVANCED_DICTATION_STATUS_ORDER.filter((status) => Boolean(statusHelpText[status]))
        .map(
          (status) => `
            <article class="dictation-status-item">
              <span class="dictation-status-pill">${escapeHtml(status)}</span>
              <p>${escapeHtml(statusHelpText[status])}</p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function normalizeScoreText(value) {
  if (isStatusValue(value)) {
    return value;
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return defaultStatus;
  }

  const roundedValue = Math.round(numericValue * 2) / 2;
  const clampedValue = Math.max(0, Math.min(10, roundedValue));
  return formatScoreValue(clampedValue);
}

const students = (appData.students || [])
  .map((record) => {
    return {
      number: String(Number(record.profile.번호)),
      name: record.profile.성명,
      values: {},
    };
  })
  .sort((left, right) => Number(left.number) - Number(right.number));

function setStatus(message, isError = false) {
  editorStatus.textContent = message;
  editorStatus.style.color = isError ? "#b42318" : "#4d645f";
}

function updateStateBadge() {
  editorStateBadge.textContent = isDirty ? "변경 있음" : "저장됨";
  editorStateBadge.classList.toggle("is-dirty", isDirty);
  editorStateBadge.classList.toggle("is-saved", !isDirty);
}

function markDirty() {
  isDirty = true;
  updateStateBadge();
}

function markSaved() {
  isDirty = false;
  updateStateBadge();
}

function getRoundValueFromSource(source, round) {
  const results = source?.results || {};

  return (
    results[round] ??
    results[String(round)] ??
    defaultStatusByRound[String(round)] ??
    defaultStatusByRound[round] ??
    defaultStatus
  );
}

function hydrateStudentsFromCurrentData() {
  advancedDictationStudents = advancedDictationData.students || {};
  defaultStatus = advancedDictationData.defaultStatus || "미실시";
  defaultStatusByRound = advancedDictationData.defaultStatusByRound || {
    1: "미제출",
    11: "미실시",
  };
  renderStatusHelpNotes();

  students.forEach((student) => {
    const source = advancedDictationStudents[student.number] || {};

    student.values = Object.fromEntries(
      roundNumbers.map((round) => [String(round), normalizeScoreText(getRoundValueFromSource(source, round))]),
    );
  });
}

function getSelectClass(value) {
  if (isStatusValue(value)) {
    return `editor-score-select ${getDictationStatusClass(value)}`;
  }

  return "editor-score-select is-score";
}

function createSelect(studentNumber, round, value) {
  const select = document.createElement("select");
  select.className = getSelectClass(value);
  select.dataset.studentNumber = studentNumber;
  select.dataset.round = String(round);

  scoreOptions.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = isStatusValue(optionValue) ? optionValue : `${optionValue}점`;
    select.append(option);
  });

  select.value = normalizeScoreText(value);
  select.addEventListener("change", () => {
    const nextValue = normalizeScoreText(select.value);
    const student = students.find((item) => item.number === studentNumber);

    if (!student) {
      return;
    }

    student.values[String(round)] = nextValue;
    select.value = nextValue;
    select.className = getSelectClass(nextValue);
    updatePreview();
    markDirty();
    setStatus("변경 내용을 반영했습니다.");
  });

  return select;
}

function renderTable() {
  editorTableHead.innerHTML = "";
  editorTableBody.innerHTML = "";

  const headRow = document.createElement("tr");
  const numberHead = document.createElement("th");
  numberHead.textContent = "번호";
  const nameHead = document.createElement("th");
  nameHead.textContent = "이름";

  headRow.append(numberHead, nameHead);

  roundNumbers.forEach((round) => {
    const th = document.createElement("th");
    th.textContent = `${round}회`;
    headRow.append(th);
  });

  editorTableHead.append(headRow);

  students.forEach((student) => {
    const row = document.createElement("tr");

    const numberCell = document.createElement("td");
    numberCell.textContent = `${student.number}번`;

    const nameCell = document.createElement("td");
    nameCell.className = "editor-student-name";
    nameCell.textContent = student.name;

    row.append(numberCell, nameCell);

    roundNumbers.forEach((round) => {
      const cell = document.createElement("td");
      const value = student.values[String(round)];
      cell.append(createSelect(student.number, round, value));
      row.append(cell);
    });

    editorTableBody.append(row);
  });
}

function buildExportData() {
  const exportedStudents = {};

  students.forEach((student) => {
    const results = {};

    roundNumbers.forEach((round) => {
      const roundKey = String(round);
      const value = student.values[roundKey];
      const roundDefault =
        defaultStatusByRound[roundKey] ??
        defaultStatusByRound[round] ??
        defaultStatus;

      if (value === roundDefault) {
        return;
      }

      results[roundKey] = /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
    });

    exportedStudents[student.number] = {
      name: student.name,
      results,
    };
  });

  return {
    scoreScale: Number(advancedDictationData.scoreScale) > 0 ? Number(advancedDictationData.scoreScale) : 10,
    defaultStatus,
    defaultStatusByRound: {
      "1": defaultStatusByRound["1"] || defaultStatusByRound[1] || "미제출",
      "11": defaultStatusByRound["11"] || defaultStatusByRound[11] || "미실시",
    },
    statusHelp: getStatusHelpText(),
    students: exportedStudents,
  };
}

function buildExportJsonText() {
  return `${JSON.stringify(buildExportData(), null, 2)}\n`;
}

function updatePreview() {
  editorPreview.value = buildExportJsonText();
}

function openHandleDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(FILE_HANDLE_DB_NAME, 1);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(FILE_HANDLE_STORE_NAME)) {
        database.createObjectStore(FILE_HANDLE_STORE_NAME);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("저장 위치 정보를 열지 못했습니다.")));
  });
}

async function readStoredHandle(key) {
  const database = await openHandleDatabase();

  if (!database) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILE_HANDLE_STORE_NAME, "readonly");
    const store = transaction.objectStore(FILE_HANDLE_STORE_NAME);
    const request = store.get(key);

    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error || new Error("저장 위치를 읽지 못했습니다.")));
    transaction.addEventListener("complete", () => database.close());
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("저장 위치 읽기를 중단했습니다.")));
  });
}

async function writeStoredHandle(key, handle) {
  const database = await openHandleDatabase();

  if (!database) {
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILE_HANDLE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(FILE_HANDLE_STORE_NAME);
    const request = store.put(handle, key);

    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error || new Error("저장 위치를 기록하지 못했습니다.")));
    transaction.addEventListener("complete", () => database.close());
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("저장 위치 기록을 중단했습니다.")));
  });
}

async function clearStoredHandle(key) {
  const database = await openHandleDatabase();

  if (!database) {
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILE_HANDLE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(FILE_HANDLE_STORE_NAME);
    const request = store.delete(key);

    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error || new Error("저장 위치 정보를 지우지 못했습니다.")));
    transaction.addEventListener("complete", () => database.close());
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("저장 위치 삭제를 중단했습니다.")));
  });
}

async function getLastSaveHandle() {
  try {
    const handle = await readStoredHandle(LAST_SAVE_HANDLE_KEY);

    if (!handle || typeof handle !== "object" || typeof handle.kind !== "string") {
      return null;
    }

    return handle;
  } catch (error) {
    console.warn("마지막 저장 위치를 읽지 못했습니다.", error);
    return null;
  }
}

async function rememberLastSaveHandle(handle) {
  try {
    await writeStoredHandle(LAST_SAVE_HANDLE_KEY, handle);
  } catch (error) {
    console.warn("마지막 저장 위치를 기록하지 못했습니다.", error);
  }
}

async function forgetLastSaveHandle() {
  try {
    await clearStoredHandle(LAST_SAVE_HANDLE_KEY);
  } catch (error) {
    console.warn("마지막 저장 위치를 지우지 못했습니다.", error);
  }
}

function parseAdvancedDictationText(fileText) {
  const trimmedText = fileText.trim();
  const payload = JSON.parse(trimmedText);

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !payload.students ||
    typeof payload.students !== "object" ||
    Array.isArray(payload.students)
  ) {
    throw new Error("결과 데이터를 읽지 못했습니다.");
  }

  return payload;
}

function getLatestRound(nextData) {
  const rounds = Object.values(nextData.students || {}).flatMap((student) =>
    Object.keys(student?.results || {})
      .map(Number)
      .filter((round) => Number.isInteger(round) && round > 0),
  );

  return rounds.length > 0 ? Math.max(...rounds) : 0;
}

function getLoadedRangeText(nextData) {
  const latestRound = getLatestRound(nextData);
  return latestRound > 0 ? `${latestRound}회까지 ` : "";
}

function rememberEditorSnapshot(nextData) {
  try {
    window.localStorage.setItem(
      EDITOR_SNAPSHOT_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        data: nextData,
      }),
    );
  } catch (error) {
    console.warn("최근 편집 내용을 브라우저에 기록하지 못했습니다.", error);
  }
}

function readEditorSnapshot() {
  try {
    const storedText = window.localStorage.getItem(EDITOR_SNAPSHOT_KEY);

    if (!storedText) {
      return null;
    }

    const snapshot = JSON.parse(storedText);

    if (!snapshot?.data) {
      return null;
    }

    return {
      ...snapshot,
      data: parseAdvancedDictationText(JSON.stringify(snapshot.data)),
    };
  } catch (error) {
    console.warn("브라우저에 저장된 최근 편집 내용을 읽지 못했습니다.", error);
    return null;
  }
}

function applyLoadedData(nextData, options = {}) {
  const { rememberSnapshot = true } = options;
  advancedDictationData = nextData;
  hydrateStudentsFromCurrentData();
  renderTable();
  updatePreview();
  markSaved();

  if (rememberSnapshot) {
    rememberEditorSnapshot(nextData);
  }
}

async function readFileText(file) {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("파일을 읽지 못했습니다."));
    reader.readAsText(file, "utf-8");
  });
}

async function getLastResultFileHandle() {
  const handle = await getLastSaveHandle();

  if (!handle || handle.kind !== "file" || typeof handle.getFile !== "function") {
    return null;
  }

  return handle;
}

function applyPickerStartIn(pickerOptions, handle) {
  if (handle) {
    pickerOptions.startIn = handle;
  }
}

async function loadDefaultResultJson() {
  const response = await fetch(`${RESULT_JSON_PATH}?v=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`${RESULT_JSON_PATH} 파일을 읽지 못했습니다.`);
  }

  return parseAdvancedDictationText(await response.text());
}

async function importFromFile(file, options = {}) {
  const { handle = null } = options;
  const fileText = await readFileText(file);
  const parsed = parseAdvancedDictationText(fileText);
  applyLoadedData(parsed);

  if (handle) {
    await rememberLastSaveHandle(handle);
  } else {
    await forgetLastSaveHandle();
  }

  setStatus(`${file.name}에서 ${getLoadedRangeText(parsed)}표를 다시 불러왔습니다.`);
}

async function openLoadPicker() {
  if (isDirty && !window.confirm("현재 변경 내용을 덮어쓰고 결과 파일을 불러올까요?")) {
    return;
  }

  if (!("showOpenFilePicker" in window)) {
    loadFileInput.click();
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      id: SAVE_PICKER_ID,
      multiple: false,
      types: [
        {
          description: "Result JSON",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });

    if (!handle) {
      return;
    }

    const file = await handle.getFile();
    await importFromFile(file, { handle });
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus("결과 파일 불러오기를 취소했습니다.");
      return;
    }

    console.warn("브라우저 파일 선택기를 열지 못해 기본 선택기로 전환합니다.", error);
    loadFileInput.click();
  }
}

async function saveWithPicker() {
  if (!("showSaveFilePicker" in window)) {
    setStatus("이 브라우저에서는 파일 직접 저장을 지원하지 않습니다. Chrome 또는 Edge에서 열어 주세요.", true);
    return;
  }

  try {
    const pickerOptions = {
      id: SAVE_PICKER_ID,
      suggestedName: "advanced-dictation-results.json",
      types: [
        {
          description: "JSON",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    };
    const lastSaveHandle = await getLastResultFileHandle();

    applyPickerStartIn(pickerOptions, lastSaveHandle);

    if (lastSaveHandle?.name) {
      pickerOptions.suggestedName = lastSaveHandle.name;
    }

    const handle = await window.showSaveFilePicker(pickerOptions);

    const savedData = buildExportData();
    const writable = await handle.createWritable();
    await writable.write(`${JSON.stringify(savedData, null, 2)}\n`);
    await writable.close();
    await rememberLastSaveHandle(handle);
    advancedDictationData = savedData;
    rememberEditorSnapshot(savedData);
    updatePreview();
    markSaved();
    setStatus(`선택한 결과 JSON 파일에 ${getLoadedRangeText(savedData)}저장했습니다.`);
  } catch (error) {
    if (error && error.name === "AbortError") {
      setStatus("파일 저장을 취소했습니다.");
      return;
    }

    if (error && (error.name === "DataCloneError" || error.name === "NotFoundError")) {
      await forgetLastSaveHandle();
      setStatus("저장 위치 정보를 새로 고쳐 다시 저장해 주세요.", true);
      return;
    }

    console.error(error);
    setStatus("파일로 저장하지 못했습니다.", true);
  }
}

loadFileButton.addEventListener("click", openLoadPicker);
loadFileInput.addEventListener("change", async () => {
  const [file] = Array.from(loadFileInput.files || []);

  if (!file) {
    return;
  }

  try {
    await importFromFile(file);
  } catch (error) {
    console.error(error);
    setStatus("결과 파일을 불러오지 못했습니다.", true);
  } finally {
    loadFileInput.value = "";
  }
});

saveFileButton.addEventListener("click", saveWithPicker);
refreshPreviewButton.addEventListener("click", () => {
  updatePreview();
  setStatus("미리보기를 새로고쳤습니다.");
});

async function initializeEditor() {
  hydrateStudentsFromCurrentData();
  renderTable();
  updatePreview();
  markSaved();

  if (window.location.protocol !== "file:") {
    try {
      const sourceData = await loadDefaultResultJson();
      applyLoadedData(sourceData);
      setStatus(`${RESULT_JSON_PATH} 파일에서 ${getLoadedRangeText(sourceData)}불러왔습니다.`);
      return;
    } catch (error) {
      console.warn(`${RESULT_JSON_PATH} 파일을 자동으로 읽지 못했습니다.`, error);
    }
  }

  const snapshot = readEditorSnapshot();
  const shouldUseSnapshot =
    snapshot && (!bundledResultData || getLatestRound(snapshot.data) >= getLatestRound(bundledResultData));

  if (shouldUseSnapshot) {
    applyLoadedData(snapshot.data, { rememberSnapshot: false });
    setStatus(`브라우저에 저장된 최근 편집 내용에서 ${getLoadedRangeText(snapshot.data)}복원했습니다.`);
    return;
  }

  if (bundledResultData) {
    applyLoadedData(bundledResultData);
    setStatus(`편집기용 데이터에서 ${getLoadedRangeText(bundledResultData)}자동으로 불러왔습니다.`);
    return;
  }

  setStatus(`${RESULT_JSON_PATH} 파일을 자동으로 읽지 못했습니다. 결과 JSON 불러오기로 같은 파일을 선택해 주세요.`, true);
}

initializeEditor();
