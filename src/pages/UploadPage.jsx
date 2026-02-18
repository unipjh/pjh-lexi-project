import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractConceptsFromPDF, startLearningChat, chatMessage, suggestConnections } from '../lib/gemini'
import { addCard, getCards, addConnection } from '../lib/firebase'
import ConceptEditor from '../components/ConceptEditor'
import ChatBubble from '../components/ChatBubble'

const MAX_TURNS = 5

// step 머신: 'upload' → 'extracting' → 'extract' → 'insight' → 'chat' → 'connect' → (navigate)
export default function UploadPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [extractedConcepts, setExtractedConcepts] = useState([])
  const [cardTitle, setCardTitle] = useState('')
  const [error, setError] = useState(null)

  // Step 3 상태
  const [myInsight, setMyInsight] = useState('')
  const [displayHistory, setDisplayHistory] = useState([])
  const [apiHistory, setApiHistory] = useState([])
  const [directionButtons, setDirectionButtons] = useState([])
  const [turnCount, setTurnCount] = useState(0)
  const [isThinking, setIsThinking] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)

  // Step 4 상태
  const [isSaving, setIsSaving] = useState(false)
  const [savedCardId, setSavedCardId] = useState(null)
  const [connectionSuggestions, setConnectionSuggestions] = useState([])  // [{card_id, reason, title}]
  const [selectedConnIds, setSelectedConnIds] = useState(new Set())
  const [isSavingConnections, setIsSavingConnections] = useState(false)
  const [connectStep, setConnectStep] = useState('saving') // 'saving' | 'suggesting' | 'done'

  const fileInputRef = useRef(null)
  const chatBottomRef = useRef(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayHistory, isThinking])

  // step이 'connect'로 바뀌면 저장 + 연결 제안 트리거
  useEffect(() => {
    if (step === 'connect') handleSaveAndSuggest()
  }, [step])

  // ── 파일 처리 ──────────────────────────────────────
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

  // ── Step 3: 인사이트 제출 ──────────────────────────
  async function handleInsightSubmit() {
    if (!myInsight.trim()) return
    setStep('chat')
    setIsThinking(true)
    try {
      const { text, buttons } = await startLearningChat(cardTitle, extractedConcepts, myInsight)
      const systemUserMsg = buildSystemUserMessage(cardTitle, extractedConcepts, myInsight)
      setApiHistory([
        { role: 'user', content: systemUserMsg },
        { role: 'model', content: text },
      ])
      setDisplayHistory([{ role: 'model', content: text }])
      setDirectionButtons(buttons)
    } catch (e) {
      setDisplayHistory([{ role: 'model', content: '오류가 발생했어요. 다시 시도해주세요.' }])
    } finally {
      setIsThinking(false)
    }
  }

  async function handleDirectionSelect(btn) {
    if (btn === '지금 바로 저장') { setStep('connect'); return }
    setDirectionButtons([])
    setShowTextInput(true)
    await sendUserMessage(btn)
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
      if (nextTurn >= MAX_TURNS) { setShowTextInput(false); setDirectionButtons(['저장하기']) }
    } catch (e) {
      setDisplayHistory([...newDisplay, { role: 'model', content: '오류가 발생했어요. 다시 시도해주세요.' }])
    } finally {
      setIsThinking(false)
    }
  }

  // ── Step 4: 카드 저장 + 연결 제안 ──────────────────
  async function handleSaveAndSuggest() {
    setIsSaving(true)
    setConnectStep('saving')
    try {
      // 기존 카드 먼저 가져오기 (새 카드 저장 전)
      const existingCards = await getCards()

      // 새 카드 저장
      const cardId = await addCard({
        title: cardTitle,
        source_file: file?.name || '',
        extracted_concepts: extractedConcepts,
        my_insight: myInsight,
        chat_history: displayHistory,
      })
      setSavedCardId(cardId)
      setIsSaving(false)

      // 기존 카드가 없으면 바로 완료
      if (existingCards.length === 0) {
        setConnectStep('done')
        return
      }

      // 연결 제안
      setConnectStep('suggesting')
      const newCard = { title: cardTitle, extracted_concepts: extractedConcepts, my_insight: myInsight }
      const suggestions = await suggestConnections(newCard, existingCards)

      // card_id에 title 붙이기
      const suggestionsWithTitle = suggestions
        .map((s) => {
          const matched = existingCards.find((c) => c.id === s.card_id)
          return matched ? { ...s, title: matched.title } : null
        })
        .filter(Boolean)

      setConnectionSuggestions(suggestionsWithTitle)
      // 기본적으로 전체 선택
      setSelectedConnIds(new Set(suggestionsWithTitle.map((s) => s.card_id)))
      setConnectStep('done')
    } catch (e) {
      setError('저장 중 오류가 발생했어요: ' + e.message)
      setConnectStep('done')
    }
  }

  // ── Step 4: 연결 저장 후 카드 페이지 이동 ──────────
  async function handleFinish() {
    if (!savedCardId) return
    setIsSavingConnections(true)
    try {
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

  // ── 렌더 ───────────────────────────────────────────
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
      {step === 'extract' && (
        <ExtractView
          file={file} cardTitle={cardTitle} onCardTitleChange={setCardTitle}
          concepts={extractedConcepts} onConceptsChange={setExtractedConcepts}
          onReset={() => { setStep('upload'); setFile(null) }}
          onNext={() => setStep('insight')}
        />
      )}
      {step === 'insight' && (
        <InsightView
          cardTitle={cardTitle} concepts={extractedConcepts}
          insight={myInsight} onInsightChange={setMyInsight}
          onBack={() => setStep('extract')} onSubmit={handleInsightSubmit}
        />
      )}
      {step === 'chat' && (
        <ChatView
          cardTitle={cardTitle} displayHistory={displayHistory} isThinking={isThinking}
          directionButtons={directionButtons} showTextInput={showTextInput}
          userInput={userInput} turnCount={turnCount} maxTurns={MAX_TURNS}
          chatBottomRef={chatBottomRef} onDirectionSelect={handleDirectionSelect}
          onUserInputChange={setUserInput} onSendMessage={handleSendMessage}
          onSave={() => setStep('connect')}
        />
      )}
      {step === 'connect' && (
        <ConnectView
          cardTitle={cardTitle}
          connectStep={connectStep}
          isSaving={isSaving}
          suggestions={connectionSuggestions}
          selectedConnIds={selectedConnIds}
          isSavingConnections={isSavingConnections}
          onToggle={toggleConnId}
          onFinish={handleFinish}
        />
      )}
    </div>
  )
}

// ── 서브 뷰 컴포넌트 ──────────────────────────────────

function UploadZone({ isDragging, error, fileInputRef, onDragOver, onDragLeave, onDrop, onFileChange }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">새 카드 만들기</h1>
        <p className="text-slate-400 mt-1 text-sm">PDF를 올리면 핵심 개념을 자동으로 뽑아드려요.</p>
      </div>
      <div
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-indigo-400 bg-indigo-950/30' : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'}`}
      >
        <div className="text-4xl mb-4">📄</div>
        <p className="text-white font-medium">PDF를 여기에 드래그하거나 클릭해서 선택</p>
        <p className="text-slate-500 text-sm mt-2">논문, 강의 자료 등 모든 PDF 가능</p>
        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onFileChange} />
      </div>
      {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
    </div>
  )
}

function ExtractingView({ fileName }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-10 h-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-6" />
      <p className="text-white font-medium">개념을 추출하는 중...</p>
      <p className="text-slate-500 text-sm mt-2">{fileName}</p>
    </div>
  )
}

function ExtractView({ file, cardTitle, onCardTitleChange, concepts, onConceptsChange, onReset, onNext }) {
  return (
    <div>
      <div className="mb-6">
        <button onClick={onReset} className="text-slate-500 hover:text-slate-300 text-sm mb-4">← 다시 업로드</button>
        <h1 className="text-2xl font-bold text-white">추출된 개념 확인</h1>
        <p className="text-slate-400 text-sm mt-1">
          <span className="text-indigo-400">{file?.name}</span>에서 {concepts.length}개 개념을 찾았어요.
        </p>
      </div>
      <div className="mb-6">
        <label className="block text-xs text-slate-500 font-medium mb-1.5">카드 제목</label>
        <input
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={cardTitle} onChange={(e) => onCardTitleChange(e.target.value)} placeholder="카드 제목"
        />
      </div>
      <div className="mb-8">
        <label className="block text-xs text-slate-500 font-medium mb-3">핵심 개념 ({concepts.length}개)</label>
        <ConceptEditor concepts={concepts} onChange={onConceptsChange} />
      </div>
      <button
        onClick={onNext} disabled={concepts.length === 0 || !cardTitle.trim()}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
      >
        다음 — 내 인사이트 입력 →
      </button>
    </div>
  )
}

function InsightView({ cardTitle, concepts, insight, onInsightChange, onBack, onSubmit }) {
  return (
    <div>
      <button onClick={onBack} className="text-slate-500 hover:text-slate-300 text-sm mb-6">← 개념 편집으로</button>
      <h1 className="text-2xl font-bold text-white mb-1">내 인사이트</h1>
      <p className="text-slate-400 text-sm mb-6">
        <span className="text-indigo-400 font-medium">{cardTitle}</span>에서 왜 이 개념이 대박이었나요?
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        {concepts.map((c, i) => (
          <span key={i} className="text-xs bg-slate-800 text-slate-400 border border-slate-700 rounded-full px-3 py-1">
            {c.name}
          </span>
        ))}
      </div>
      <textarea
        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 min-h-[120px]"
        placeholder="예: attention이 결국 context를 동적으로 재구성한다는 게 신선했다. 정적인 임베딩의 한계를 이게 뚫어주는 느낌."
        value={insight} onChange={(e) => onInsightChange(e.target.value)}
      />
      <button
        onClick={onSubmit} disabled={!insight.trim()}
        className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
      >
        AI와 대화 시작 →
      </button>
    </div>
  )
}

function ChatView({
  cardTitle, displayHistory, isThinking,
  directionButtons, showTextInput, userInput,
  turnCount, maxTurns, chatBottomRef,
  onDirectionSelect, onUserInputChange, onSendMessage, onSave,
}) {
  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 5rem)' }}>
      <div className="mb-4 pb-4 border-b border-slate-800">
        <p className="text-xs text-slate-500 font-medium">학습 대화</p>
        <p className="text-white font-semibold">{cardTitle}</p>
        <p className="text-xs text-slate-600 mt-0.5">{turnCount}/{maxTurns}턴</p>
      </div>
      <div className="flex-1 space-y-4 mb-4">
        {displayHistory.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
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
      {directionButtons.length > 0 && !isThinking && (
        <div className="flex flex-col gap-2 mb-4">
          {directionButtons.map((btn) => (
            <button
              key={btn} onClick={() => onDirectionSelect(btn)}
              className={`text-sm py-2.5 px-4 rounded-xl border transition-colors text-left
                ${btn === '지금 바로 저장'
                  ? 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                  : 'border-indigo-700 bg-indigo-950/50 text-indigo-300 hover:bg-indigo-900/50'
                }`}
            >
              {btn === '지금 바로 저장' ? '💾 지금 바로 저장' : `→ ${btn}`}
            </button>
          ))}
        </div>
      )}
      {showTextInput && !isThinking && directionButtons.length === 0 && (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
            placeholder="계속 대화하기..."
            value={userInput} onChange={(e) => onUserInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
          />
          <button
            onClick={onSendMessage} disabled={!userInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 rounded-xl transition-colors text-sm"
          >
            전송
          </button>
        </div>
      )}
      {directionButtons.includes('저장하기') && (
        <button onClick={onSave} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors">
          저장하기 →
        </button>
      )}
      {showTextInput && !directionButtons.includes('저장하기') && (
        <button onClick={onSave} className="mt-2 w-full text-slate-500 hover:text-white text-sm py-2 border border-slate-800 hover:border-slate-600 rounded-xl transition-colors">
          지금 저장하기
        </button>
      )}
    </div>
  )
}

function ConnectView({ cardTitle, connectStep, isSaving, suggestions, selectedConnIds, isSavingConnections, onToggle, onFinish }) {
  // 로딩 중
  if (connectStep === 'saving' || connectStep === 'suggesting') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-10 h-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-white font-medium">
          {connectStep === 'saving' ? '카드를 저장하는 중...' : '연결을 찾는 중...'}
        </p>
        <p className="text-slate-500 text-sm mt-2">
          {connectStep === 'suggesting' ? '기존 카드들과 의미 있는 연결을 탐색해요.' : ''}
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* 저장 완료 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 text-sm">✓</div>
          <h1 className="text-2xl font-bold text-white">저장 완료!</h1>
        </div>
        <p className="text-slate-400 text-sm">
          <span className="text-indigo-400 font-medium">{cardTitle}</span> 카드가 저장됐어요.
        </p>
      </div>

      {/* 연결 제안 */}
      {suggestions.length > 0 ? (
        <div className="mb-8">
          <p className="text-sm font-medium text-white mb-1">연결 제안</p>
          <p className="text-xs text-slate-500 mb-4">AI가 기존 카드와의 연결을 찾았어요. 저장할 연결을 선택하세요.</p>
          <div className="space-y-3">
            {suggestions.map((s) => (
              <label
                key={s.card_id}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors
                  ${selectedConnIds.has(s.card_id)
                    ? 'border-indigo-600 bg-indigo-950/40'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-indigo-500 shrink-0"
                  checked={selectedConnIds.has(s.card_id)}
                  onChange={() => onToggle(s.card_id)}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{s.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.reason}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700 text-center">
          <p className="text-slate-400 text-sm">연결할 기존 카드가 없어요.</p>
          <p className="text-slate-500 text-xs mt-1">카드가 더 쌓이면 자동으로 연결이 생겨요.</p>
        </div>
      )}

      <button
        onClick={onFinish}
        disabled={isSavingConnections}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors"
      >
        {isSavingConnections ? '저장 중...' : `완료 — 카드 보기 →`}
      </button>
    </div>
  )
}

// ── 헬퍼 ─────────────────────────────────────────────

function buildSystemUserMessage(cardTitle, concepts, insight) {
  return `너는 학습 코치야. 사용자가 공부한 개념에 대해 짧고 날카로운 대화로 이해를 깊게 해줘.

사용자가 공부한 내용:
- 주제: ${cardTitle}
- 핵심 개념: ${concepts.map((c) => c.name).join(', ')}
- 사용자의 인사이트: "${insight}"`
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
