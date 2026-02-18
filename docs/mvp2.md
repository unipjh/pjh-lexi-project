# LEXI — MVP Section 2 변경 기록

> Section 1에서 핵심 플로우를 완성했다면, Section 2는 "실제로 쓰고 싶은 서비스"로 고도화하는 작업이었다. 개념 추출 품질, 인사이트 구조화, 전체 UI 라이트 테마, 그리고 대화 UX 개선이 핵심이었다.

---

## 1. 왜 Section 2가 필요했나

Section 1을 쓰면서 바로 느낀 문제 세 가지:

1. **개념 추출이 너무 평평하다.** `[{name, description}]` flat 구조는 PDF의 계층 구조를 반영하지 못했다. 챕터 아래 세부 개념이 전부 같은 레벨에 나열됐다.
2. **인사이트를 한 줄만 쓸 수 있다.** `my_insight` 필드 하나에 모든 걸 담아야 했다. 개념별로 다른 인사이트가 있는데 섞어서 써야 했다.
3. **다크 테마가 맞지 않는다.** 지식 사전은 독서에 가까운 경험인데, 다크 테마는 개발 도구 느낌이 강했다.
4. **채팅 첫 응답에 JSON이 보인다.** 방향 버튼을 `BUTTONS:[...]` 형식으로 파싱하다 보니 가끔 날것의 JSON이 노출됐다.

---

## 2. 스키마 변경

Firestore는 스키마리스라 마이그레이션 없이 필드를 추가했다. 기존 MVP1 카드와의 **하위 호환성**을 유지하는 것이 핵심 제약이었다.

### cards 컬렉션 변경사항

```
extracted_concepts: [              ← 구조 변경 (flat → 계층)
  {
    name: string,
    description: string,
    sub_concepts: [                ← 신규 (없으면 flat으로 렌더링)
      { name: string, description: string }
    ]
  }
]

insights: [                        ← 신규 필드
  {
    concept_name: string,
    sub_concept_name: string,
    content: string,
    tags: [string]
  }
]

tags: [string]                     ← 신규 필드 (카드 레벨 태그)
my_insight: string                 ← 기존 유지 (deprecated, 하위 호환 표시)
```

`connections` 컬렉션은 변경 없음.

---

## 3. 변경/신규 파일 목록

### 신규 파일 (3개)
| 파일 | 역할 |
|------|------|
| `src/components/InsightToggle.jsx` | 하위 개념별 인사이트 토글 입력 |
| `src/components/TagInput.jsx` | Notion 스타일 태그 입력 칩 |
| `src/pages/ContinueChatPage.jsx` | 기존 카드의 대화 이어가기 (`/chat/:id`) |

### 수정 파일 (8개)
| 파일 | 변경 규모 | 주요 내용 |
|------|-----------|-----------|
| `src/lib/gemini.js` | 중간 | 계층 추출 프롬프트, 채팅 프롬프트 개선 |
| `src/lib/firebase.js` | 소 | `updateCard`, `deleteCard` 추가 |
| `src/pages/UploadPage.jsx` | 대 | insight 단계 제거, 계층 개념 + InsightToggle 통합 |
| `src/pages/CardPage.jsx` | 대 | 제목 편집, 태그, 계층 개념 표시, 삭제 기능 |
| `src/pages/GraphPage.jsx` | 중간 | 4-tier 노드 색상, 필터, 라이트 테마 |
| `src/components/ConceptEditor.jsx` | 대 | 계층 구조 편집 지원 |
| `src/components/ChatBubble.jsx` | 소 | 라이트 테마 색상 |
| `src/App.jsx` | 소 | 라이트 테마, `/chat/:id` 라우트 추가 |
| `src/components/Navbar.jsx` | 소 | 라이트 테마 |
| `src/index.css` | 소 | Tailwind v4 다크모드 자동감지 버그 수정 |

---

## 4. 기능별 변경 상세

### 4-1. 계층적 개념 추출 (gemini.js)

**변경 전**: 최대 10개 flat `[{name, description}]`

**변경 후**: 최대 15개 상위 + 각 2~6개 하위

프롬프트를 JSON 형식 예시와 규칙으로 구성해 구조를 강제했다. Gemini가 자유 텍스트를 섞지 않도록 "반드시 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마" 지시를 유지했다.

`suggestConnections`도 `flattenConceptNames` 헬퍼로 상위+하위 개념 이름을 모두 추출해 연결 제안 품질을 높였다.

### 4-2. 소분류별 인사이트 — InsightToggle + 스텝 통합

**변경 전**: 별도 insight 단계에서 `my_insight` 한 줄 입력

**변경 후**: extract 단계에서 하위 개념별로 인라인 토글 입력

단계를 줄인 이유: 개념을 보면서 바로 인사이트를 쓰는 게 더 자연스럽다. PDF 내용이 눈앞에 있을 때 떠오른 생각을 그 자리에서 기록해야 '내 언어로 정착'되는 경험이 된다.

```
변경 전: upload → extracting → extract → insight → chat → connect
변경 후: upload → extracting → extract → chat → connect
```

`insights` 배열은 `{concept_name, sub_concept_name, content, tags:[]}` 형태로, 어떤 개념의 어떤 하위 개념에 대한 인사이트인지 명확하게 저장된다.

### 4-3. TagInput 컴포넌트

Notion Select 스타일의 태그 입력. Enter 또는 쉼표로 태그 추가, ×로 제거, 중복 방지.

`getTagColor(tag)` 함수로 태그명 해시 기반 일관된 컬러 칩(6가지 색상)을 부여한다. 같은 태그는 어디서든 같은 색으로 표시된다.

ConnectView(저장 완료 화면)에서 카드 레벨 태그를 달 수 있고, CardPage에서도 TagInput으로 편집하면 즉시 Firestore에 저장된다(낙관적 UI 업데이트).

### 4-4. ContinueChatPage (신규)

라우트: `/chat/:id`

CardPage의 "대화 이어가기" 버튼에서 진입. 기존 `chat_history`를 로드해 이어서 대화하고, 세션당 최대 5턴. "대화 저장" 버튼으로 `updateCard(id, { chat_history })` 후 CardPage로 복귀.

**API 히스토리 분리 패턴**: 화면에 보이는 `displayHistory`와 Gemini에 전송하는 `apiHistory`를 분리해 관리한다. `apiHistory` 맨 앞에 숨겨진 시스템 지시(학습 코치 역할, 질문으로 끝내기)를 삽입해, 기존 대화를 이어가면서도 일관된 응답 스타일을 유지한다.

### 4-5. CardPage 기능 추가

Section 1에서 읽기 전용이었던 CardPage에 편집 기능을 추가했다.

- **제목 인라인 편집**: 제목 클릭 → 인풋 전환 → Enter 또는 blur 시 `updateCard` 저장
- **태그 편집**: `TagInput` 컴포넌트, 변경 즉시 Firestore 저장
- **계층 개념 표시**: 상위 > 하위 계층 구조. `sub_concepts` 없으면 flat 칩으로 렌더링(하위 호환)
- **인사이트 표시**: 각 하위 개념 아래 💡 아이콘과 함께 인사이트 텍스트 표시
- **deprecated `my_insight` 하위 호환**: 기존 MVP1 카드의 `my_insight` 필드가 있으면 인디고 블록쿼트로 표시
- **카드 삭제**: 위험 영역 섹션, 인라인 2단계 확인 패턴("카드 삭제" → "정말 삭제할까요? 확인/취소"). `deleteCard`는 card와 연결된 모든 connections를 동시에 삭제

### 4-6. GraphPage — 4-tier 노드 색상 + 필터

연결 수 기반 4단계 색상으로 노드의 '중요도'를 한눈에 파악할 수 있다.

| 연결 수 | 색상 | 의미 |
|---------|------|------|
| 0–2 | `#94a3b8` 회색 | 기본 |
| 3–5 | `#3b82f6` 블루 | 연결 시작 |
| 6–9 | `#8b5cf6` 바이올렛 | 허브 |
| 10+ | `#f59e0b` 앰버 | 핵심 노드 |

사이드바에 티어 필터 버튼을 추가했다. 특정 티어를 선택하면 해당 티어 노드는 강조, 나머지는 `globalAlpha: 0.2`로 dim 처리된다.

### 4-7. 채팅 UX 개선 — JSON 제거 + 자연스러운 대화

**변경 전**: `BUTTONS:[...]` JSON 형식을 AI 응답에 강제 포함 → 파싱해서 버튼 표시. 가끔 JSON이 그대로 노출됐고, 버튼 선택이라는 별도 인터랙션이 끊기는 느낌을 줬다.

**변경 후**: 버튼 완전 제거. AI 응답이 항상 자연스러운 대화체로, 마지막 문장은 반드시 사용자의 생각을 묻는 질문으로 끝난다.

프롬프트 규칙:
```
- 2~3문장으로 간결하게
- 마지막 문장은 반드시 사용자의 생각을 묻는 질문으로 끝내
- JSON, 버튼, 목록 형식은 절대 사용하지 마
```

첫 AI 응답 후 바로 텍스트 입력창이 표시되며, "지금 저장하기" 버튼으로 언제든 저장할 수 있다.

### 4-8. 전체 UI 라이트 테마

다크 → 라이트 테마 전환. 디자인 레퍼런스: Linear, Vercel.

```
배경:        bg-white
서피스:      bg-slate-50
보더:        border-slate-200 (1px)
주요 텍스트: text-slate-900
서브 텍스트: text-slate-500
뮤트:        text-slate-400
액센트:      text-indigo-600
```

**Tailwind v4 다크모드 버그**: Tailwind v4는 OS 다크모드를 자동으로 감지해 적용한다. `index.css`에 `color-scheme: light`와 명시적 배경색을 지정해 고정했다.

```css
@layer base {
  html, body {
    background-color: white;
    color: #0f172a;
    color-scheme: light;
  }
}
```

---

## 5. 아키텍처 결정사항

### 하위 호환 전략

Firestore는 스키마리스라 기존 MVP1 카드들이 새 필드 없이 그대로 남아 있다. CardPage에서 `hasHierarchy` 체크(`sub_concepts` 존재 여부)로 렌더링을 분기했다.

```javascript
const hasHierarchy = concepts.some((c) => c.sub_concepts?.length > 0)
// true → 계층 구조 렌더링
// false → flat 칩 렌더링 (MVP1 카드)
```

### 낙관적 UI 업데이트 (TagInput)

TagInput onChange 시 UI를 즉시 업데이트하고 Firestore 저장은 비동기로 처리한다. 저장 실패 시 silent fail(롤백 없음). 태그 편집의 체감 속도를 위해 선택한 트레이드오프다.

### displayHistory / apiHistory 분리

UploadPage와 ContinueChatPage 모두 이 패턴을 사용한다. 사용자에게 보이는 히스토리와 AI에 보내는 히스토리를 분리해, 시스템 컨텍스트 주입이나 hidden 메시지를 자유롭게 추가할 수 있다.

---

## 6. 파일 구조 (Section 2 완성 기준)

```
src/
├── lib/
│   ├── firebase.js       # addCard, getCards, updateCard, deleteCard, connections CRUD
│   └── gemini.js         # extractConceptsFromPDF(계층), startLearningChat, chatMessage, suggestConnections
├── pages/
│   ├── UploadPage.jsx    # 업로드 플로우 (4단계: upload→extracting→extract→chat→connect)
│   ├── CardPage.jsx      # 카드 상세 + 편집 + 삭제
│   ├── GraphPage.jsx     # 그래프 탐색 + 4-tier 필터
│   └── ContinueChatPage.jsx  # 대화 이어가기 (/chat/:id)
├── components/
│   ├── Navbar.jsx        # 라이트 테마 네비게이션
│   ├── ConceptEditor.jsx # 계층 구조 편집 (상위/하위 추가·수정·삭제)
│   ├── InsightToggle.jsx # 하위 개념별 인사이트 토글 입력
│   ├── TagInput.jsx      # Notion 스타일 태그 입력 칩
│   └── ChatBubble.jsx    # 라이트 테마 채팅 버블
└── App.jsx               # 라이트 테마 + /chat/:id 라우트
```

---

## 7. Section 3 고려사항

쓰면서 자연스럽게 생긴 아이디어들. 지금은 건드리지 않는다.

- **복습 알림**: 저장한 카드를 며칠 후 다시 떠올리게 하는 스페이스드 리피티션
- **연결 강도 시각화**: 연결 수 외에 개념 유사도를 링크 굵기로 표현
- **모바일 최적화**: 현재 데스크탑 기준 레이아웃
- **태그 기반 필터**: GraphPage 카드 목록을 태그로 필터링
- **Vercel 배포**: 로컬 개발 완료 후 배포

---

> Section 2에서 "쓰고 싶은 서비스"의 기준을 올렸다. 개념 계층화와 소분류별 인사이트 덕분에 같은 PDF를 올려도 훨씬 풍부한 카드가 만들어진다. 대화 UX도 자연스러워졌다. 이제 실제로 논문을 올리면서 써볼 차례다.
