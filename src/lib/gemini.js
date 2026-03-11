const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`

// ── 내부 헬퍼 ──────────────────────────────────────────

// 개념 배열에서 모든 개념 이름 추출 (상위 + 하위 포함)
function flattenConceptNames(concepts) {
  return (concepts || []).flatMap((c) => [
    c.name,
    ...((c.sub_concepts || []).map((s) => s.name)),
  ]).join(', ')
}

// 인사이트 배열을 텍스트로 변환
function formatInsights(insights) {
  if (!insights || insights.length === 0) return '없음'
  const lines = insights
    .filter((i) => i.content?.trim())
    .map((i) => `- ${i.sub_concept_name || i.concept_name}: "${i.content}"`)
  return lines.length > 0 ? lines.join('\n') : '없음'
}

async function callGemini(contents) {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'Gemini API 오류')
  }
  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}

// PDF에서 핵심 개념 계층적 추출
// base64Data: FileReader로 읽은 base64 문자열 (data: URI 제외한 순수 base64)
export async function extractConceptsFromPDF(base64Data, mimeType = 'application/pdf') {
  const prompt = `이 PDF 문서의 핵심 개념을 계층적으로 추출해줘.
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.

[
  {
    "name": "상위 개념",
    "description": "한 줄 설명 (50자 이내)",
    "source_text": "PDF 원문에서 그대로 발췌한 텍스트",
    "sub_concepts": [
      {
        "name": "하위 개념",
        "description": "한 줄 설명 (40자 이내)",
        "source_text": "PDF 원문 발췌"
      }
    ]
  }
]

규칙:
- 상위 개념: 최대 15개. PDF의 대주제/챕터/핵심 섹션 단위로 추출.
- 하위 개념: 상위 개념당 2~6개. 구체적 용어, 기법, 세부 개념을 불릿 형태로.
- 결과 전체가 PDF의 '키워드 요약본'처럼 보여야 함.
- 중복 없이, 실제 문서에 등장하는 내용만 추출.
- source_text는 해당 개념이 정의되거나 설명되는 문장을 PDF 원문에서 그대로 발췌.
- 단어 하나나 제목만 쓰지 말고, 맥락이 담긴 구 또는 문장으로 발췌 (15자 이상 권장).
- 요약/변형/번역 금지 — 원문 그대로.
- 원문에서 찾을 수 없으면 source_text는 빈 문자열로 반환.`

  const contents = [
    {
      parts: [
        { inline_data: { mime_type: mimeType, data: base64Data } },
        { text: prompt },
      ],
    },
  ]

  const raw = await callGemini(contents)
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('개념 추출 결과를 파싱할 수 없습니다.')
  return JSON.parse(jsonMatch[0])
}

// 학습 대화 1턴
// messages: [{role: 'user'|'model', content: string}]
export async function chatMessage(messages) {
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }))

  return await callGemini(contents)
}

// 첫 학습 대화 시작 — insights 배열을 받아 대화 시작
// insights: [{concept_name, sub_concept_name, content, tags:[]}]
export async function startLearningChat(cardTitle, concepts, insights) {
  const conceptNames = flattenConceptNames(concepts)
  const insightText = formatInsights(insights)

  const systemPrompt = `너는 학습 코치야. 사용자가 공부한 개념에 대해 짧고 날카로운 대화로 이해를 깊게 해줘.

사용자가 공부한 내용:
- 주제: ${cardTitle}
- 핵심 개념: ${conceptNames}
- 사용자의 인사이트:
${insightText}

위 내용을 읽고, 가장 흥미로운 포인트를 짚어서 짧게 응답해줘.

규칙:
- 2~3문장으로 간결하게
- 마지막 문장은 반드시 사용자의 생각을 묻는 질문으로 끝내
- JSON, 버튼, 목록 형식 없이 자연스러운 대화체로만`

  const messages = [{ role: 'user', content: systemPrompt }]
  const text = await chatMessage(messages)

  return { text: text.trim() }
}

// 기존 카드들과의 연결 제안
export async function suggestConnections(newCard, existingCards) {
  if (existingCards.length === 0) return []

  const existingCardsSummary = existingCards
    .map((c) => {
      const conceptNames = flattenConceptNames(c.extracted_concepts)
      const insightText = c.my_insight || formatInsights(c.insights)
      return `- ID: ${c.id}, 제목: ${c.title}, 개념: ${conceptNames}, 인사이트: "${insightText}"`
    })
    .join('\n')

  const prompt = `새로운 개념 카드와 기존 카드들 사이의 의미있는 연결을 찾아줘.

새 카드:
- 제목: ${newCard.title}
- 핵심 개념: ${flattenConceptNames(newCard.extracted_concepts)}
- 인사이트: "${formatInsights(newCard.insights) || newCard.my_insight || ''}"

기존 카드 목록:
${existingCardsSummary}

연결될 만한 카드들을 골라서 반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.
연결이 없으면 빈 배열 []을 반환해.

[
  { "card_id": "카드ID", "reason": "연결 이유 한 줄 (40자 이내)" },
  ...
]`

  const raw = await callGemini([{ parts: [{ text: prompt }] }])
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []
  return JSON.parse(jsonMatch[0])
}
