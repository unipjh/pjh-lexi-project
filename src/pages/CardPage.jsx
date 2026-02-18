import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getCard, getConnections, getCard as getCardById, updateCard, deleteCard } from '../lib/firebase'
import ChatBubble from '../components/ChatBubble'
import TagInput from '../components/TagInput'

export default function CardPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [card, setCard] = useState(null)
  const [connectedCards, setConnectedCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // 인라인 제목 편집
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [isSavingTitle, setIsSavingTitle] = useState(false)

  // 태그 편집
  const [tags, setTags] = useState([])

  // 삭제
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => { loadCard() }, [id])

  async function loadCard() {
    setIsLoading(true)
    setNotFound(false)
    try {
      const cardData = await getCard(id)
      if (!cardData) { setNotFound(true); return }
      setCard(cardData)
      setTags(cardData.tags || [])

      const connections = await getConnections(id)
      const connectedList = await Promise.all(
        connections.map(async (conn) => {
          const otherId = conn.card_id_a === id ? conn.card_id_b : conn.card_id_a
          const other = await getCardById(otherId)
          return other ? { id: otherId, title: other.title, reason: conn.reason } : null
        })
      )
      setConnectedCards(connectedList.filter(Boolean))
    } catch {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveTitle() {
    if (!editTitle.trim() || isSavingTitle) return
    setIsSavingTitle(true)
    try {
      await updateCard(id, { title: editTitle.trim() })
      setCard((prev) => ({ ...prev, title: editTitle.trim() }))
      setIsEditingTitle(false)
    } finally {
      setIsSavingTitle(false)
    }
  }

  async function handleSaveTags(newTags) {
    setTags(newTags)
    try {
      await updateCard(id, { tags: newTags })
    } catch {
      // silent fail — UI 이미 낙관적으로 업데이트됨
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setIsDeleting(true)
    try {
      await deleteCard(id)
      navigate('/graph')
    } catch {
      setIsDeleting(false)
      setDeleteConfirm(false)
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

  const createdAt = card.created_at?.toDate?.()
  const dateStr = createdAt
    ? createdAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const concepts = card.extracted_concepts || []
  const insights = card.insights || []
  const chatHistory = card.chat_history || []
  const hasHierarchy = concepts.some((c) => c.sub_concepts?.length > 0)

  return (
    <div className="pt-20 pb-20 px-6 max-w-3xl mx-auto">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/graph')}
          className="text-slate-400 hover:text-slate-700 text-sm transition-colors"
        >
          ← 탐색으로
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{dateStr}</span>
          <button
            onClick={() => navigate(`/chat/${id}`)}
            className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            대화 이어가기
          </button>
        </div>
      </div>

      {/* 카드 제목 (인라인 편집) */}
      <div className="mb-2">
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="flex-1 text-3xl font-bold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle()
                if (e.key === 'Escape') setIsEditingTitle(false)
              }}
              onBlur={handleSaveTitle}
            />
            {isSavingTitle && <span className="text-xs text-slate-400">저장 중...</span>}
          </div>
        ) : (
          <h1
            className="text-3xl font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={() => { setEditTitle(card.title); setIsEditingTitle(true) }}
            title="클릭해서 제목 편집"
          >
            {card.title}
          </h1>
        )}
      </div>

      {card.source_file && (
        <p className="text-xs text-slate-400 mb-4">📄 {card.source_file}</p>
      )}

      {/* 태그 */}
      <div className="mb-8">
        <TagInput tags={tags} onChange={handleSaveTags} placeholder="태그 추가..." />
      </div>

      {/* Bento 섹션들 */}
      <div className="space-y-4">

        {/* 정리 (계층 개념 + 인사이트) */}
        {concepts.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">정리</h2>
            {hasHierarchy ? (
              <div className="space-y-3">
                {concepts.map((concept, i) => {
                  const conceptInsights = insights.filter((ins) => ins.concept_name === concept.name)
                  return (
                    <div key={i} className="border border-slate-100 rounded-lg overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-50">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-slate-800">{concept.name}</span>
                          {concept.description && (
                            <span className="text-xs text-slate-400">{concept.description}</span>
                          )}
                        </div>
                      </div>
                      {concept.sub_concepts?.length > 0 && (
                        <div className="divide-y divide-slate-100">
                          {concept.sub_concepts.map((sub, j) => {
                            const subInsight = conceptInsights.find((ins) => ins.sub_concept_name === sub.name)
                            return (
                              <div key={j} className="px-4 py-2">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-slate-300 text-[10px]">└</span>
                                  <span className="text-xs font-medium text-slate-700">{sub.name}</span>
                                  {sub.description && (
                                    <span className="text-[11px] text-slate-400">{sub.description}</span>
                                  )}
                                </div>
                                {subInsight?.content && (
                                  <div className="mt-1 pl-3 flex items-start gap-1">
                                    <span className="text-indigo-400 text-[10px] mt-0.5 shrink-0">💡</span>
                                    <p className="text-xs text-indigo-700 leading-relaxed">{subInsight.content}</p>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              // 하위 호환: flat 구조
              <div className="flex flex-wrap gap-2">
                {concepts.map((c, i) => (
                  <div key={i} className="group relative">
                    <span className="text-sm bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 cursor-default hover:border-indigo-300 hover:text-slate-900 transition-colors">
                      {c.name}
                    </span>
                    {c.description && (
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-56 bg-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 shadow-xl">
                        {c.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 기존 my_insight 하위 호환 표시 */}
        {card.my_insight && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4">
            <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">내 인사이트</h2>
            <p className="text-indigo-800 text-sm leading-relaxed italic">"{card.my_insight}"</p>
          </div>
        )}

        {/* 대화 내용 */}
        {chatHistory.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">대화 내용</h2>
              <button
                onClick={() => navigate(`/chat/${id}`)}
                className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                이어가기 →
              </button>
            </div>
            <div className="space-y-3">
              {chatHistory.map((msg, i) => (
                <ChatBubble key={i} role={msg.role} content={msg.content} />
              ))}
            </div>
          </div>
        )}

        {/* 연결된 카드 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            연결된 카드 {connectedCards.length > 0 && `(${connectedCards.length})`}
          </h2>
          {connectedCards.length > 0 ? (
            <div className="space-y-2">
              {connectedCards.map((c) => (
                <Link
                  key={c.id}
                  to={`/card/${c.id}`}
                  className="block bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl px-4 py-3 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {c.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.reason}</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-indigo-500 text-sm shrink-0">→</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">아직 연결된 카드가 없어요.</p>
          )}
        </div>
      </div>

      {/* 위험 영역 */}
      <div className="mt-12 pt-8 border-t border-slate-200">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">위험 영역</p>
        <p className="text-xs text-slate-400 mb-4">이 카드와 연결된 모든 연결이 함께 삭제됩니다.</p>
        {deleteConfirm ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">정말 삭제할까요?</span>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {isDeleting ? '삭제 중...' : '확인'}
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="text-sm bg-white border border-red-200 text-red-500 hover:bg-red-50 px-4 py-1.5 rounded-lg transition-colors"
          >
            카드 삭제
          </button>
        )}
      </div>
    </div>
  )
}
