const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`

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

// PDF에서 핵심 개념 추출
// base64Data: FileReader로 읽은 base64 문자열 (data: URI 제외한 순수 base64)
export async function extractConceptsFromPDF(base64Data, mimeType = 'application/pdf') {
  const prompt = `이 PDF 문서에서 핵심 개념들을 추출해줘.
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.

[
  { "name": "개념명", "description": "한 줄 설명 (50자 이내)" },
  ...
]

개념은 최대 10개까지만 추출해.`

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

// 첫 학습 대화 시작 — 인사이트를 받아 방향 제안
export async function startLearningChat(cardTitle, concepts, insight) {
  const conceptNames = concepts.map((c) => c.name).join(', ')
  const systemPrompt = `너는 학습 코치야. 사용자가 공부한 개념에 대해 짧고 날카로운 대화로 이해를 깊게 해줘.

사용자가 공부한 내용:
- 주제: ${cardTitle}
- 핵심 개념: ${conceptNames}
- 사용자의 인사이트: "${insight}"

위 인사이트를 읽고, 다음 중 가장 적합한 방향 하나를 골라서 짧게 응답해줘.
응답은 2~3문장으로 간결하게. 그리고 마지막에 사용자가 선택할 수 있는 방향 버튼 3개를 JSON으로 제시해.

형식:
[응답 텍스트]

BUTTONS:["더 깊이 파고들기", "다른 개념과 연결해보기", "지금 바로 저장"]`

  const messages = [{ role: 'user', content: systemPrompt }]
  const raw = await chatMessage(messages)

  const buttonMatch = raw.match(/BUTTONS:\[([^\]]+)\]/)
  const buttons = buttonMatch
    ? JSON.parse(`[${buttonMatch[1]}]`)
    : ['더 깊이 파고들기', '다른 개념과 연결해보기', '지금 바로 저장']
  const text = raw.replace(/BUTTONS:\[([^\]]+)\]/, '').trim()

  return { text, buttons }
}

// 기존 카드들과의 연결 제안
export async function suggestConnections(newCard, existingCards) {
  if (existingCards.length === 0) return []

  const existingCardsSummary = existingCards
    .map((c) => `- ID: ${c.id}, 제목: ${c.title}, 인사이트: "${c.my_insight || ''}"`)
    .join('\n')

  const prompt = `새로운 개념 카드와 기존 카드들 사이의 의미있는 연결을 찾아줘.

새 카드:
- 제목: ${newCard.title}
- 핵심 개념: ${(newCard.extracted_concepts || []).map((c) => c.name).join(', ')}
- 인사이트: "${newCard.my_insight || ''}"

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
