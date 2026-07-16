import { readFile, writeFile } from "node:fs/promises";

const sourceUrl = new URL("../src/generated/advanced-dictation-results.json", import.meta.url);
const targetUrl = new URL("../advanced-dictation-editor-data.js", import.meta.url);
const sourceText = await readFile(sourceUrl, "utf8");
const resultData = JSON.parse(sourceText);
const generatedText = `// Generated from src/generated/advanced-dictation-results.json. Do not edit directly.\nwindow.ADVANCED_DICTATION_EDITOR_DATA = ${JSON.stringify(resultData, null, 2)};\n`;

await writeFile(targetUrl, generatedText, "utf8");
