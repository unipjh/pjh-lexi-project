import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractConceptsFromPDF, startLearningChat, chatMessage, suggestConnections } from '../lib/gemini'
import { addCard, getCards, addConnection, updateCard } from '../lib/firebase'
import ConceptEditor from '../components/ConceptEditor'
import ConceptPanel, { COLORS } from '../components/ConceptPanel'
import TagInput from '../components/TagInput'
import ChatBubble from '../components/ChatBubble'
import PDFViewer from '../components/PDFViewer'

const MAX_TURNS = 5

// step 머신: 'upload' → 'extracting' → 'extract' → 'chat' → 'connect'
export default function UploadPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [extractedConcepts, setExtractedConcepts] = useState([])
  const [cardTitle, setCardTitle] = useState('')
  const [error, setError] = useState(null)

  // 인사이트 배열: [{concept_name, sub_concept_name, content, tags:[]}]
  const [insights, setInsights] = useState([])

  // 채팅 상태
  const [displayHistory, setDisplayHistory] = useState([])
  const [apiHistory, setApiHistory] = useState([])
  const [turnCount, setTurnCount] = useState(0)
  const [isThinking, setIsThinking] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)

  // 연결/저장 상태
  const [cardTags, setCardTags] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [savedCardId, setSavedCardId] = useState(null)
  const [connectionSuggestions, setConnectionSuggestions] = useState([])
  const [selectedConnIds, setSelectedConnIds] = useState(new Set())
  const [isSavingConnections, setIsSavingConnections] = useState(false)
  const [connectStep, setConnectStep] = useState('saving')

  const fileInputRef = useRef(null)
  const chatBottomRef = useRef(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayHistory, isThinking])

  useEffect(() => {
    if (step === 'connect') handleSaveAndSuggest()
  }, [step])

  // ── 인사이트 헬퍼 ──
  function getInsightContent(conceptName, subConceptName) {
    const found = insights.find(
      (i) => i.concept_name === conceptName && i.sub_concept_name === subConceptName
    )
    return found?.content || ''
  }

  function setInsightContent(conceptName, subConceptName, content) {
    setInsights((prev) => {
      const idx = prev.findIndex(
        (i) => i.concept_name === conceptName && i.sub_concept_name === subConceptName
      )
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], content }
        return next
      }
      return [...prev, { concept_name: conceptName, sub_concept_name: subConceptName, content, tags: [] }]
    })
  }

  // ── 파일 처리 ──
  function handleFileSelect(selectedFile) {
    if (!selectedFile || selectedFile.type !== 'application/pdf') {
      setError('PDF 파일만 업로드할 수 있어요.')
      return
    }
    setFile(selectedFile)
    setError(null)
    handleExtract(selectedFile)
  }

  async function handleExtract(targetFile) {
    setStep('extracting')
    try {
      const base64 = await fileToBase64(targetFile)
      const concepts = await extractConceptsFromPDF(base64)
      setExtractedConcepts(concepts)
      setCardTitle(targetFile.name.replace(/\.pdf$/i, ''))
      setStep('extract')
    } catch (e) {
      setError(e.message || '개념 추출 중 오류가 발생했어요.')
      setStep('upload')
    }
  }

  function handleDragOver(e) { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave() { setIsDragging(false) }
  function handleDrop(e) {
    e.preventDefault(); setIsDragging(false)
    handleFileSelect(e.dataTransfer.files[0])
  }

  // ── 채팅 시작 ──
  async function handleStartChat() {
    setStep('chat')
    setIsThinking(true)
    try {
      const { text } = await startLearningChat(cardTitle, extractedConcepts, insights)
      setApiHistory([
        { role: 'user', content: buildSystemPrompt(cardTitle, extractedConcepts, insights) },
        { role: 'model', content: text },
      ])
      setDisplayHistory([{ role: 'model', content: text }])
      setShowTextInput(true)
    } catch (e) {
      setDisplayHistory([{ role: 'model', content: '오류가 발생했어요. 다시 시도해주세요.' }])
      setShowTextInput(true)
    } finally {
      setIsThinking(false)
    }
  }

  async function handleSendMessage() {
    if (!userInput.trim() || isThinking) return
    const msg = userInput.trim()
    setUserInput('')
    await sendUserMessage(msg)
  }

  async function sendUserMessage(msg) {
    const newDisplay = [...displayHistory, { role: 'user', content: msg }]
    const newApi = [...apiHistory, { role: 'user', content: msg }]
    setDisplayHistory(newDisplay)
    setApiHistory(newApi)
    setIsThinking(true)
    try {
      const reply = await chatMessage(newApi)
      const nextTurn = turnCount + 1
      setTurnCount(nextTurn)
      setDisplayHistory([...newDisplay, { role: 'model', content: reply }])
      setApiHistory([...newApi, { role: 'model', content: reply }])
      if (nextTurn >= MAX_TURNS) { setShowTextInput(false) }
    } catch (e) {
      setDisplayHistory([...newDisplay, { role: 'model', content: '오류가 발생했어요. 다시 시도해주세요.' }])
    } finally {
      setIsThinking(false)
    }
  }

  // ── 카드 저장 + 연결 제안 ──
  async function handleSaveAndSuggest() {
    setIsSaving(true)
    setConnectStep('saving')
    try {
      const existingCards = await getCards()
      const cardId = await addCard({
        title: cardTitle,
        source_file: file?.name || '',
        extracted_concepts: extractedConcepts,
        insights: insights.filter((i) => i.content?.trim()),
        tags: cardTags,
        my_insight: '',
        chat_history: displayHistory,
      })
      setSavedCardId(cardId)
      setIsSaving(false)

      if (existingCards.length === 0) { setConnectStep('done'); return }

      setConnectStep('suggesting')
      const newCard = {
        title: cardTitle,
        extracted_concepts: extractedConcepts,
        insights: insights.filter((i) => i.content?.trim()),
      }
      const suggestions = await suggestConnections(newCard, existingCards)
      const suggestionsWithTitle = suggestions
        .map((s) => {
          const matched = existingCards.find((c) => c.id === s.card_id)
          return matched ? { ...s, title: matched.title } : null
        })
        .filter(Boolean)
      setConnectionSuggestions(suggestionsWithTitle)
      setSelectedConnIds(new Set(suggestionsWithTitle.map((s) => s.card_id)))
      setConnectStep('done')
    } catch (e) {
      setError('저장 중 오류가 발생했어요: ' + e.message)
      setConnectStep('done')
    }
  }

  async function handleFinish() {
    if (!savedCardId) return
    setIsSavingConnections(true)
    try {
      if (cardTags.length > 0) {
        await updateCard(savedCardId, { tags: cardTags })
      }
      const selected = connectionSuggestions.filter((s) => selectedConnIds.has(s.card_id))
      await Promise.all(
        selected.map((s) =>
          addConnection({ card_id_a: savedCardId, card_id_b: s.card_id, reason: s.reason })
        )
      )
      navigate(`/card/${savedCardId}`)
    } catch (e) {
      setIsSavingConnections(false)
    }
  }

  function toggleConnId(cardId) {
    setSelectedConnIds((prev) => {
      const next = new Set(prev)
      next.has(cardId) ? next.delete(cardId) : next.add(cardId)
      return next
    })
  }

  // ── 렌더 ──
  // extract 단계는 전체 화면 레이아웃이 필요해서 별도 분기
  if (step === 'extract') {
    return (
      <div className="pt-16 pb-4 px-6 h-screen flex flex-col overflow-hidden">
        <ExtractView
          file={file} cardTitle={cardTitle} onCardTitleChange={setCardTitle}
          concepts={extractedConcepts} onConceptsChange={setExtractedConcepts}
          insights={insights}
          onInsightChange={setInsightContent}
          getInsightContent={getInsightContent}
          onReset={() => { setStep('upload'); setFile(null); setInsights([]) }}
          onNext={handleStartChat}
        />
      </div>
    )
  }

  return (
    <div className="pt-20 pb-16 px-6 max-w-2xl mx-auto">
      {step === 'upload' && (
        <UploadZone
          isDragging={isDragging} error={error} fileInputRef={fileInputRef}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave}
          onDrop={handleDrop} onFileChange={(e) => handleFileSelect(e.target.files[0])}
        />
      )}
      {step === 'extracting' && <ExtractingView fileName={file?.name} />}
      {step === 'chat' && (
        <ChatView
          cardTitle={cardTitle} displayHistory={displayHistory} isThinking={isThinking}
          showTextInput={showTextInput} userInput={userInput}
          turnCount={turnCount} maxTurns={MAX_TURNS}
          chatBottomRef={chatBottomRef}
          onUserInputChange={setUserInput} onSendMessage={handleSendMessage}
          onSave={() => setStep('connect')}
        />
      )}
      {step === 'connect' && (
        <ConnectView
          cardTitle={cardTitle} connectStep={connectStep} isSaving={isSaving}
          suggestions={connectionSuggestions} selectedConnIds={selectedConnIds}
          isSavingConnections={isSavingConnections} cardTags={cardTags}
          onTagsChange={setCardTags} onToggle={toggleConnId} onFinish={handleFinish}
        />
      )}
    </div>
  )
}

// ── 서브 뷰 컴포넌트 ──

function UploadZone({ isDragging, error, fileInputRef, onDragOver, onDragLeave, onDrop, onFileChange }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">새 카드 만들기</h1>
        <p className="text-slate-500 mt-1 text-sm">PDF를 올리면 핵심 개념을 자동으로 뽑아드려요.</p>
      </div>
      <div
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors
          ${isDragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white'
          }`}
      >
        <div className="text-4xl mb-4">📄</div>
        <p className="text-slate-800 font-medium">PDF를 여기에 드래그하거나 클릭해서 선택</p>
        <p className="text-slate-400 text-sm mt-2">논문, 강의 자료 등 모든 PDF 가능</p>
        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onFileChange} />
      </div>
      {error && <p className="mt-4 text-red-500 text-sm text-center">{error}</p>}
    </div>
  )
}

function ExtractingView({ fileName }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
      <p className="text-slate-800 font-medium">개념을 추출하는 중...</p>
      <p className="text-slate-400 text-sm mt-2">{fileName}</p>
    </div>
  )
}

function ExtractView({
  file, cardTitle, onCardTitleChange,
  concepts, onConceptsChange,
  insights, onInsightChange, getInsightContent,
  onReset, onNext,
}) {
  const [showEditor, setShowEditor] = useState(false)
  const [activeConceptName, setActiveConceptName] = useState(null)

  const hasAnyInsight = insights.some((i) => i.content?.trim())

  // 개념별 하이라이트 배열 — COLORS index가 ConceptPanel 도트 색과 동기화
  const highlights = concepts.flatMap((concept, i) => {
    const color = COLORS[i % COLORS.length]
    const result = []
    if (concept.source_text) {
      result.push({ source_text: concept.source_text, concept_name: concept.name, color })
    }
    concept.sub_concepts?.forEach((sub) => {
      if (sub.source_text) {
        result.push({ source_text: sub.source_text, concept_name: sub.name, color })
      }
    })
    return result
  })

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="mb-3 shrink-0">
        <button
          onClick={onReset}
          className="text-slate-400 hover:text-slate-700 text-sm transition-colors"
        >
          ← 다시 업로드
        </button>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">추출된 개념 확인</h1>
      </div>

      {/* 60/40 분할 레이아웃 */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* PDFViewer — 60% */}
        <div className="w-[60%] shrink-0 border border-slate-200 rounded-xl overflow-hidden">
          <PDFViewer
            file={file}
            highlights={highlights}
            activeConceptName={activeConceptName}
          />
        </div>

        {/* 우측 패널 — 40% */}
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          {/* 카드 제목 */}
          <div className="shrink-0">
            <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1.5">
              카드 제목
            </label>
            <input
              className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
              value={cardTitle}
              onChange={(e) => onCardTitleChange(e.target.value)}
              placeholder="카드 제목"
            />
          </div>

          {/* 개념 목록 헤더 */}
          <div className="flex items-center justify-between shrink-0">
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              핵심 개념 ({concepts.length}개)
            </label>
            <button
              onClick={() => setShowEditor(true)}
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
            >
              편집
            </button>
          </div>

          {/* ConceptPanel — 스크롤 가능 */}
          <div className="flex-1 overflow-y-auto">
            <ConceptPanel
              concepts={concepts}
              activeConceptName={activeConceptName}
              onConceptClick={setActiveConceptName}
              getInsightContent={getInsightContent}
              onInsightChange={onInsightChange}
            />
          </div>

          {/* 하단 버튼 */}
          <div className="shrink-0 space-y-2">
            {hasAnyInsight && (
              <p className="text-xs text-indigo-500">
                💡 인사이트가 입력됐어요. AI와 대화에서 이 내용을 바탕으로 시작할게요.
              </p>
            )}
            <button
              onClick={onNext}
              disabled={concepts.length === 0 || !cardTitle.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
            >
              {hasAnyInsight ? 'AI와 대화 시작 →' : '인사이트 없이 대화 시작 →'}
            </button>
          </div>
        </div>
      </div>

      {/* ConceptEditor 모달 오버레이 */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <h2 className="font-semibold text-slate-800">개념 편집</h2>
              <button
                onClick={() => setShowEditor(false)}
                className="text-slate-400 hover:text-slate-700 text-sm transition-colors"
              >
                닫기
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <ConceptEditor concepts={concepts} onChange={onConceptsChange} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChatView({
  cardTitle, displayHistory, isThinking,
  showTextInput, userInput, turnCount, maxTurns, chatBottomRef,
  onUserInputChange, onSendMessage, onSave,
}) {
  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 5rem)' }}>
      <div className="mb-4 pb-4 border-b border-slate-200">
        <p className="text-xs text-slate-400 font-medium">대화 내용</p>
        <p className="text-slate-900 font-semibold">{cardTitle}</p>
        <p className="text-xs text-slate-400 mt-0.5">{turnCount}/{maxTurns}턴</p>
      </div>
      <div className="flex-1 space-y-4 mb-4">
        {displayHistory.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {showTextInput && !isThinking && (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
            placeholder="계속 대화하기..."
            value={userInput} onChange={(e) => onUserInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
          />
          <button
            onClick={onSendMessage} disabled={!userInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 rounded-xl transition-colors text-sm"
          >
            전송
          </button>
        </div>
      )}
      {turnCount >= maxTurns && !showTextInput && (
        <button onClick={onSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors">
          저장하기 →
        </button>
      )}
      {showTextInput && (
        <button onClick={onSave} className="mt-2 w-full text-slate-400 hover:text-slate-700 text-sm py-2 border border-slate-200 hover:border-slate-300 rounded-xl transition-colors bg-white">
          지금 저장하기
        </button>
      )}
    </div>
  )
}

function ConnectView({
  cardTitle, connectStep, isSaving, suggestions, selectedConnIds,
  isSavingConnections, cardTags, onTagsChange, onToggle, onFinish,
}) {
  if (connectStep === 'saving' || connectStep === 'suggesting') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-slate-800 font-medium">
          {connectStep === 'saving' ? '카드를 저장하는 중...' : '연결을 찾는 중...'}
        </p>
        {connectStep === 'suggesting' && (
          <p className="text-slate-400 text-sm mt-2">기존 카드들과 의미 있는 연결을 탐색해요.</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm">✓</div>
          <h1 className="text-2xl font-bold text-slate-900">저장 완료!</h1>
        </div>
        <p className="text-slate-500 text-sm">
          <span className="text-indigo-600 font-medium">{cardTitle}</span> 카드가 저장됐어요.
        </p>
      </div>

      <div className="mb-8">
        <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">태그</label>
        <TagInput tags={cardTags} onChange={onTagsChange} placeholder="태그 추가 (Enter 또는 ,)" />
        <p className="text-xs text-slate-400 mt-1.5">이 카드를 나중에 찾을 때 쓸 태그를 달아보세요.</p>
      </div>

      {suggestions.length > 0 ? (
        <div className="mb-8">
          <p className="text-sm font-semibold text-slate-800 mb-1">연결 제안</p>
          <p className="text-xs text-slate-400 mb-4">AI가 기존 카드와의 연결을 찾았어요. 저장할 연결을 선택하세요.</p>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <label
                key={s.card_id}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors
                  ${selectedConnIds.has(s.card_id)
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-indigo-600 shrink-0"
                  checked={selectedConnIds.has(s.card_id)}
                  onChange={() => onToggle(s.card_id)}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{s.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.reason}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <p className="text-slate-500 text-sm">연결할 기존 카드가 없어요.</p>
          <p className="text-slate-400 text-xs mt-1">카드가 더 쌓이면 자동으로 연결이 생겨요.</p>
        </div>
      )}

      <button
        onClick={onFinish}
        disabled={isSavingConnections}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors"
      >
        {isSavingConnections ? '저장 중...' : '완료 — 카드 보기 →'}
      </button>
    </div>
  )
}

// ── 헬퍼 ──

function buildSystemPrompt(cardTitle, concepts, insights) {
  const conceptNames = concepts.flatMap((c) => [
    c.name,
    ...(c.sub_concepts || []).map((s) => s.name),
  ]).join(', ')

  const insightLines = insights
    .filter((i) => i.content?.trim())
    .map((i) => `- ${i.sub_concept_name || i.concept_name}: "${i.content}"`)
    .join('\n')

  return `너는 학습 코치야. 사용자가 공부한 개념에 대해 짧고 날카로운 대화로 이해를 깊게 해줘.

사용자가 공부한 내용:
- 주제: ${cardTitle}
- 핵심 개념: ${conceptNames}
- 사용자의 인사이트:
${insightLines || '없음'}

규칙:
- 각 응답은 2~3문장으로 간결하게
- 마지막 문장은 반드시 사용자의 생각을 묻는 질문으로 끝내
- JSON, 버튼, 목록 형식은 절대 사용하지 마`
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
