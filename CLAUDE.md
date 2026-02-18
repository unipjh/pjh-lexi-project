# LEXI — 나만의 AI 지식 사전

## 프로젝트 개요
AI 전공자가 논문/강의교안에서 배운 개념을 **내 언어로 정착**시키고, 그 맥락 기반으로 개념들이 연결되는 개인 지식 사전.
자세한 기획은 @docs/product_definition.md 참고.

## 기술 스택
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Database**: Firebase Firestore
- **AI**: Gemini API (개념 추출 / 학습 대화 / 연결 제안 / PDF 처리)
- **배포**: Vercel

## 프로젝트 구조
```
lexi/
├── src/
│   ├── components/       # UI 컴포넌트
│   ├── pages/            # 3개 화면 (Upload, Card, Graph)
│   ├── lib/
│   │   ├── firebase.js   # Firestore 클라이언트 + CRUD 함수
│   │   └── gemini.js     # Gemini API 호출 함수
│   ├── App.jsx
│   └── main.jsx
├── docs/
│   ├── product_definition.md   # 기획 문서
│   └── db_schema.md            # DB 스키마 정의
├── .env.local            # Firebase 설정값 + VITE_GEMINI_API_KEY
├── CLAUDE.md
└── package.json
```

## 핵심 화면 (3개)
1. **Upload** — PDF 업로드 → 개념 추출 확인/편집 → 인사이트 입력 → 학습 대화 → 저장
2. **Card** — 저장된 개념 카드 상세 보기 (인사이트 + 대화 기록 + 연결 카드)
3. **Graph** — 전체 카드 목록 + 연결 그래프 + 검색

## 개발 규칙

### 필수
- 백엔드 서버 없음. Firebase Firestore + Gemini API를 프론트에서 직접 호출
- 환경변수는 반드시 `.env.local` 사용 (절대 하드코딩 금지)
- 컴포넌트는 함수형 + hooks만 사용

### 코드 스타일
- 변수/함수명: camelCase
- 컴포넌트명: PascalCase
- Tailwind utility class 우선, 별도 CSS 파일 최소화
- async/await 사용 (Promise chain 지양)

### Gemini API 호출 패턴
```javascript
// src/lib/gemini.js 에 함수로 모아서 관리
// 직접 fetch 사용 (SDK 설치 없이)
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
});
```

### Firebase 패턴
```javascript
// src/lib/firebase.js 에서 초기화 후 import해서 사용
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
```

## DB 컬렉션 (Firebase Firestore)
자세한 스키마는 @docs/db_schema.md 참고.

```
cards          — 개념 카드 (id, title, source_file, extracted_concepts, my_insight, chat_history, created_at)
connections    — 카드 간 연결 (id, card_id_a, card_id_b, reason, created_at)
```

## 환경변수 (.env.local)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
```

## 작업 시 주의사항
- 모든 코드 수정은 계획을 세운 후 실행 확인 요청
- MVP 범위 외 기능 추가 전에 반드시 확인 요청
- 새 npm 패키지 설치 전에 꼭 알려줄 것
- 오류 발생 시 콘솔 에러 메시지 전체를 공유해야 정확한 디버깅 가능
