import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getCard, getConnections, getCard as getCardById } from '../lib/firebase'
import ChatBubble from '../components/ChatBubble'

export default function CardPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [card, setCard] = useState(null)
  const [connectedCards, setConnectedCards] = useState([])  // [{id, title, reason}]
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    loadCard()
  }, [id])

  async function loadCard() {
    setIsLoading(true)
    setNotFound(false)
    try {
      const cardData = await getCard(id)
      if (!cardData) { setNotFound(true); return }
      setCard(cardData)

      // 연결된 카드 정보 로드
      const connections = await getConnections(id)
      const connectedList = await Promise.all(
        connections.map(async (conn) => {
          const otherId = conn.card_id_a === id ? conn.card_id_b : conn.card_id_a
          const other = await getCardById(otherId)
          return other ? { id: otherId, title: other.title, reason: conn.reason } : null
        })
      )
      setConnectedCards(connectedList.filter(Boolean))
    } catch (e) {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="pt-20 flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="pt-20 px-6 max-w-2xl mx-auto text-center py-24">
        <p className="text-slate-400 text-lg mb-4">카드를 찾을 수 없어요.</p>
        <button onClick={() => navigate('/graph')} className="text-indigo-400 hover:text-indigo-300 text-sm">
          ← 탐색으로 돌아가기
        </button>
      </div>
    )
  }

  const createdAt = card.created_at?.toDate?.()
  const dateStr = createdAt
    ? createdAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className="pt-20 pb-20 px-6 max-w-2xl mx-auto">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/graph')}
          className="text-slate-500 hover:text-slate-300 text-sm"
        >
          ← 탐색으로
        </button>
        <span className="text-xs text-slate-600">{dateStr}</span>
      </div>

      {/* 카드 제목 */}
      <h1 className="text-3xl font-bold text-white mb-2">{card.title}</h1>
      {card.source_file && (
        <p className="text-xs text-slate-500 mb-8">
          📄 {card.source_file}
        </p>
      )}

      {/* 핵심 개념 태그 */}
      {card.extracted_concepts?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">핵심 개념</h2>
          <div className="flex flex-wrap gap-2">
            {card.extracted_concepts.map((c, i) => (
              <div key={i} className="group relative">
                <span className="text-sm bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 cursor-default hover:border-indigo-600 hover:text-white transition-colors">
                  {c.name}
                </span>
                {c.description && (
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-56 bg-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 shadow-xl">
                    {c.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 내 인사이트 */}
      {card.my_insight && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">내 인사이트</h2>
          <blockquote className="bg-indigo-950/50 border-l-4 border-indigo-500 rounded-r-xl px-5 py-4">
            <p className="text-indigo-100 text-sm leading-relaxed italic">"{card.my_insight}"</p>
          </blockquote>
        </section>
      )}

      {/* 학습 대화 기록 */}
      {card.chat_history?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">학습 대화</h2>
          <div className="space-y-3">
            {card.chat_history.map((msg, i) => (
              <ChatBubble key={i} role={msg.role} content={msg.content} />
            ))}
          </div>
        </section>
      )}

      {/* 연결된 카드 */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          연결된 카드 {connectedCards.length > 0 && `(${connectedCards.length})`}
        </h2>
        {connectedCards.length > 0 ? (
          <div className="space-y-3">
            {connectedCards.map((c) => (
              <Link
                key={c.id}
                to={`/card/${c.id}`}
                className="block bg-slate-800/60 border border-slate-700 hover:border-indigo-600 rounded-xl px-4 py-3 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                      {c.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{c.reason}</p>
                  </div>
                  <span className="text-slate-600 group-hover:text-indigo-400 text-sm shrink-0">→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-slate-600 text-sm">아직 연결된 카드가 없어요.</p>
        )}
      </section>
    </div>
  )
}
