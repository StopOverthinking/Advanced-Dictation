# Advanced Dictation

React 기반 단어장 웹앱과 단어 자료, PDF 생성 스크립트를 포함한 저장소입니다.

## Files

- `vocabularies.txt`: 단어 데이터 원본
- `src/`: React 앱 소스
- `docs/`: 빌드 결과물(GitHub Pages 배포용)
- `scripts/generate_vocab_pdfs.py`: PDF 생성 스크립트

## Web

```powershell
npm install
npm run dev
npm run build
```

## PDF

```powershell
python .\scripts\generate_vocab_pdfs.py
```
