import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCard, updateCard } from '../lib/firebase'
import { chatMessage } from '../lib/gemini'
import ChatBubble from '../components/ChatBubble'

const MAX_TURNS = 5

// 기존 카드의 채팅을 이어가는 페이지
// 라우트: /chat/:id
export default function ContinueChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [card, setCard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [displayHistory, setDisplayHistory] = useState([])
  const [apiHistory, setApiHistory] = useState([])
  const [userInput, setUserInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [turnCount, setTurnCount] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  const chatBottomRef = useRef(null)

  useEffect(() => { loadCard() }, [id])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayHistory, isThinking])

  async function loadCard() {
    setIsLoading(true)
    setNotFound(false)
    try {
      const cardData = await getCard(id)
      if (!cardData) { setNotFound(true); return }
      setCard(cardData)

      // 기존 대화를 displayHistory로 로드
      const existingHistory = cardData.chat_history || []
      setDisplayHistory(existingHistory)

      // API 히스토리: 숨겨진 시스템 지시 + 기존 대화
      const systemInstruction = `너는 학습 코치야. 사용자가 "${cardData.title}"에 대해 학습한 내용을 바탕으로 대화를 이어가줘.
규칙:
- 각 응답은 2~3문장으로 간결하게
- 마지막 문장은 반드시 사용자의 생각을 묻는 질문으로 끝내
- JSON, 버튼, 목록 형식은 절대 사용하지 마`
      const apiBase = [
        { role: 'user', content: systemInstruction },
        { role: 'model', content: '알겠어요! 함께 이야기해봐요.' },
        ...existingHistory.map((m) => ({ role: m.role, content: m.content })),
      ]
      setApiHistory(apiBase)
    } catch {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendMessage() {
    if (!userInput.trim() || isThinking) return
    const msg = userInput.trim()
    setUserInput('')

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
    } catch {
      setDisplayHistory([...newDisplay, { role: 'model', content: '오류가 발생했어요. 다시 시도해주세요.' }])
    } finally {
      setIsThinking(false)
    }
  }

  async function handleSave() {
    if (!card || isSaving) return
    setIsSaving(true)
    try {
      await updateCard(id, { chat_history: displayHistory })
      navigate(`/card/${id}`)
    } catch {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="pt-20 flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="pt-20 px-6 max-w-2xl mx-auto text-center py-24">
        <p className="text-slate-500 text-lg mb-4">카드를 찾을 수 없어요.</p>
        <button onClick={() => navigate('/graph')} className="text-indigo-600 hover:text-indigo-700 text-sm">
          ← 탐색으로 돌아가기
        </button>
      </div>
    )
  }

  const hasNewMessages = turnCount > 0

  return (
    <div className="pt-20 pb-16 px-6 max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
      {/* 헤더 */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/card/${id}`)}
            className="text-slate-400 hover:text-slate-700 text-sm transition-colors"
          >
            ← 카드로
          </button>
          {hasNewMessages && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {isSaving ? '저장 중...' : '대화 저장'}
            </button>
          )}
        </div>
        <div className="mt-3">
          <p className="text-xs text-slate-400 font-medium">대화 이어가기</p>
          <p className="text-slate-900 font-semibold">{card.title}</p>
          {hasNewMessages && (
            <p className="text-xs text-slate-400 mt-0.5">이번 세션 {turnCount}턴 / 최대 {MAX_TURNS}턴</p>
          )}
        </div>
      </div>

      {/* 대화 목록 */}
      <div className="flex-1 space-y-4 mb-4">
        {displayHistory.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">아직 대화 기록이 없어요.</p>
            <p className="text-slate-400 text-xs mt-1">아래에 메시지를 입력해서 대화를 시작해보세요.</p>
          </div>
        ) : (
          displayHistory.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))
        )}
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

      {/* 입력 영역 */}
      {turnCount < MAX_TURNS ? (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
            placeholder="이 카드에 대해 더 이야기해보세요..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            disabled={isThinking}
          />
          <button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || isThinking}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 rounded-xl transition-colors text-sm"
          >
            전송
          </button>
        </div>
      ) : (
        <div className="text-center py-3">
          <p className="text-slate-400 text-sm mb-3">이번 세션 최대 턴에 도달했어요.</p>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-xl transition-colors text-sm"
          >
            {isSaving ? '저장 중...' : '대화 저장하고 카드 보기 →'}
          </button>
        </div>
      )}
    </div>
  )
}
