import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ForceGraph2D from 'react-force-graph-2d'
import { getCards, getAllConnections } from '../lib/firebase'

export default function GraphPage() {
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [connections, setConnections] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 })
  const [hoveredCardId, setHoveredCardId] = useState(null)

  const graphContainerRef = useRef(null)
  const fgRef = useRef(null)

  useEffect(() => { loadData() }, [])

  // 그래프 컨테이너 크기 측정
  useEffect(() => {
    if (isLoading) return
    function updateSize() {
      if (!graphContainerRef.current) return
      const { width, height } = graphContainerRef.current.getBoundingClientRect()
      setGraphSize({ width, height })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [isLoading])

  async function loadData() {
    setIsLoading(true)
    try {
      const [cardsData, connsData] = await Promise.all([getCards(), getAllConnections()])
      setCards(cardsData)
      setConnections(connsData)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredCards = cards.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const graphData = {
    nodes: cards.map((c) => ({ id: c.id, title: c.title })),
    links: connections
      .filter((conn) => {
        const ids = new Set(cards.map((c) => c.id))
        return ids.has(conn.card_id_a) && ids.has(conn.card_id_b)
      })
      .map((conn) => ({
        source: conn.card_id_a,
        target: conn.card_id_b,
        reason: conn.reason,
      })),
  }

  const handleNodeClick = useCallback((node) => {
    navigate(`/card/${node.id}`)
  }, [navigate])

  const handleNodeHover = useCallback((node) => {
    setHoveredCardId(node ? node.id : null)
    document.body.style.cursor = node ? 'pointer' : 'default'
  }, [])

  // 카드 목록에서 클릭 시 그래프 노드 포커스
  function handleCardListClick(card) {
    navigate(`/card/${card.id}`)
  }

  // 커스텀 노드 렌더링
  const paintNode = useCallback((node, ctx, globalScale) => {
    const isHovered = node.id === hoveredCardId
    const r = isHovered ? 7 : 5

    // 원
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = isHovered ? '#6366f1' : '#4338ca'
    ctx.fill()
    ctx.strokeStyle = isHovered ? '#a5b4fc' : '#6366f1'
    ctx.lineWidth = isHovered ? 2 : 1
    ctx.stroke()

    // 라벨 (줌이 일정 이상일 때만 표시)
    if (globalScale >= 0.5) {
      const maxLen = 14
      const label = node.title.length > maxLen ? node.title.slice(0, maxLen) + '…' : node.title
      const fontSize = Math.min(12, Math.max(8, 11 / globalScale))
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = isHovered ? '#e0e7ff' : '#94a3b8'
      ctx.fillText(label, node.x, node.y + r + 2)
    }
  }, [hoveredCardId])

  const paintNodePointerArea = useCallback((node, color, ctx) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI)
    ctx.fill()
  }, [])

  if (isLoading) {
    return (
      <div className="pt-14 flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">카드를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-14 flex bg-slate-950" style={{ height: 'calc(100vh)' }}>

      {/* ── 왼쪽: 카드 목록 ── */}
      <div className="w-72 shrink-0 border-r border-slate-800 flex flex-col">
        {/* 검색 */}
        <div className="p-4 border-b border-slate-800">
          <p className="text-xs text-slate-500 font-medium mb-3">
            전체 카드 {cards.length}개
          </p>
          <input
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
            placeholder="카드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 카드 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredCards.length === 0 ? (
            <div className="text-center py-12">
              {cards.length === 0 ? (
                <>
                  <p className="text-slate-500 text-sm">아직 카드가 없어요.</p>
                  <a href="/" className="text-indigo-400 hover:text-indigo-300 text-xs mt-2 block">
                    첫 카드 만들기 →
                  </a>
                </>
              ) : (
                <p className="text-slate-500 text-sm">검색 결과가 없어요.</p>
              )}
            </div>
          ) : (
            filteredCards.map((card) => {
              const connCount = connections.filter(
                (c) => c.card_id_a === card.id || c.card_id_b === card.id
              ).length
              const createdAt = card.created_at?.toDate?.()
              const dateStr = createdAt
                ? createdAt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                : ''

              return (
                <button
                  key={card.id}
                  onClick={() => handleCardListClick(card)}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-slate-800 transition-colors group mb-1"
                >
                  <p className="text-sm text-white font-medium truncate group-hover:text-indigo-300 transition-colors">
                    {card.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-600">{dateStr}</span>
                    {connCount > 0 && (
                      <span className="text-xs text-indigo-500">연결 {connCount}</span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── 오른쪽: 그래프 ── */}
      <div ref={graphContainerRef} className="flex-1 relative overflow-hidden">
        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-5xl mb-4">🕸️</div>
              <p className="text-slate-400 text-sm mb-2">아직 연결 그래프가 없어요.</p>
              <p className="text-slate-600 text-xs">카드를 2개 이상 만들면 그래프가 생겨요.</p>
            </div>
          </div>
        ) : (
          <>
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={graphSize.width}
              height={graphSize.height}
              backgroundColor="#020617"
              nodeCanvasObject={paintNode}
              nodePointerAreaPaint={paintNodePointerArea}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              linkColor={() => '#334155'}
              linkWidth={1.5}
              linkLabel="reason"
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.003}
              linkDirectionalParticleColor={() => '#6366f1'}
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />

            {/* 줌/이동 힌트 */}
            <div className="absolute bottom-4 right-4 text-xs text-slate-700 select-none">
              스크롤로 줌 · 드래그로 이동 · 클릭으로 카드 열기
            </div>
          </>
        )}
      </div>
    </div>
  )
}
