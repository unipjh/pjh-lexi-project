<!-- problem-first-summary:start -->
**Huge Problem(Pain Point):** 수업과 논문에서 이해한 개념이 시간이 지나면 내 언어와 맥락으로 회상되지 않는다.

**솔루션 한 줄 정의:** PDF에서 개념을 추출하고 개인 인사이트·AI 대화·연결 이유를 카드로 축적하는 지식 사전이다.

**현재 상태:** 개인 MVP

**문제 해결 중심의 사고 흐름**

1. **관찰** — 기존 노트 도구는 구조를 만드는 부담이 크고, 왜 특정 개념이 중요했는지 개인 맥락을 남기기 어려웠다.
2. **선택** — PDF 업로드 후 한 줄 인사이트만으로도 저장할 수 있게 하고 연결 기준을 키워드보다 이해 맥락에 두었다.
3. **구현** — React 3개 화면, Firebase 카드·연결 컬렉션, Gemini 개념 추출·학습 대화·연결 제안을 구현했다.
4. **검증과 한계** — 제품 정의와 DB 스키마, 실제 MVP 코드가 존재한다. 루트 README는 아직 Vite 기본 문서라 제품 설명으로 교체가 필요하다.
<!-- problem-first-summary:end -->

---
# LEXI - Personal AI Knowledge Dictionary

LEXI turns concepts from papers and lecture PDFs into a personal knowledge graph built around the learner's own language and context.

## Core flow

1. Upload a PDF and review AI-extracted concepts.
2. Add one short personal insight instead of writing a finished note.
3. Use a focused AI conversation to deepen or connect the idea.
4. Save a concept card and review why it connects to previous cards.
5. Explore cards through search and a connection graph.

## Product decisions

- Connections use the learner's understanding context, not only matching keywords.
- A one-line insight is enough to save, reducing note-taking friction.
- AI connection suggestions include an explanation so the learner can accept them critically.
- The MVP stays within upload, card detail, and graph exploration screens.

## Stack and data

React 19 and Vite provide the frontend. Firebase Firestore stores cards and connections, while Gemini handles concept extraction, learning conversations, PDF processing, and connection suggestions.

The main collections are cards and connections. See docs/product_definition.md and docs/db_schema.md for the product definition and schema.

## Local development

1. Install dependencies with npm install.
2. Add Firebase and Gemini values to .env.local.
3. Start the app with npm run dev.

Required variables are documented in CLAUDE.md. Never commit .env.local.

## Current limits

This is a personal MVP. Review scheduling, connection strength scoring, mobile optimization, and multi-user support are intentionally outside the current scope.
