import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ForceGraph2D from 'react-force-graph-2d'
import { getCards, getAllConnections } from '../lib/firebase'

// 연결 수 기반 4단계 노드 색상
const TIER_COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b']
const TIER_LABELS = ['0–2', '3–5', '6–9', '10+']

function getConnTier(connCount) {
  if (connCount >= 10) return 3
  if (connCount >= 6) return 2
  if (connCount >= 3) return 1
  return 0
}

export default function GraphPage() {
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [connections, setConnections] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 })
  const [hoveredCardId, setHoveredCardId] = useState(null)
  const [filterTier, setFilterTier] = useState(null)

  const graphContainerRef = useRef(null)
  const fgRef = useRef(null)

  useEffect(() => { loadData() }, [])

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

  // 카드별 연결 수 맵
  const connCountMap = {}
  cards.forEach((c) => { connCountMap[c.id] = 0 })
  connections.forEach((conn) => {
    if (connCountMap[conn.card_id_a] !== undefined) connCountMap[conn.card_id_a]++
    if (connCountMap[conn.card_id_b] !== undefined) connCountMap[conn.card_id_b]++
  })

  const graphData = {
    nodes: cards.map((c) => ({ id: c.id, title: c.title, connCount: connCountMap[c.id] || 0 })),
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

  function handleCardListClick(card) {
    navigate(`/card/${card.id}`)
  }

  const paintNode = useCallback((node, ctx, globalScale) => {
    const tier = getConnTier(node.connCount || 0)
    const isHovered = node.id === hoveredCardId
    const isFiltered = filterTier !== null
    const isHighlighted = filterTier === tier

    const r = isHovered ? 7 : 5
    const baseColor = TIER_COLORS[tier]

    ctx.globalAlpha = isFiltered && !isHighlighted ? 0.2 : 1

    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = baseColor
    ctx.fill()

    if (isHovered || (isFiltered && isHighlighted)) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
    } else {
      ctx.strokeStyle = baseColor
      ctx.lineWidth = 0.5
    }
    ctx.stroke()

    if (globalScale >= 0.5) {
      const maxLen = 14
      const label = node.title.length > maxLen ? node.title.slice(0, maxLen) + '…' : node.title
      const fontSize = Math.min(12, Math.max(8, 11 / globalScale))
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = isHovered ? '#1e293b' : '#64748b'
      ctx.fillText(label, node.x, node.y + r + 2)
    }

    ctx.globalAlpha = 1
  }, [hoveredCardId, filterTier])

  const paintNodePointerArea = useCallback((node, color, ctx) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI)
    ctx.fill()
  }, [])

  if (isLoading) {
    return (
      <div className="pt-14 flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">카드를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-14 flex bg-white" style={{ height: 'calc(100vh)' }}>

      {/* ── 왼쪽: 카드 목록 ── */}
      <div className="w-72 shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-200">
          <p className="text-xs text-slate-400 font-medium mb-3">
            전체 카드 {cards.length}개
          </p>
          <input
            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
            placeholder="카드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 티어 필터 */}
        <div className="px-4 py-3 border-b border-slate-200">
          <p className="text-[11px] text-slate-400 font-medium mb-2">연결 수 필터</p>
          <div className="flex flex-wrap gap-1.5">
            {TIER_COLORS.map((color, tier) => (
              <button
                key={tier}
                onClick={() => setFilterTier(filterTier === tier ? null : tier)}
                className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border transition-colors
                  ${filterTier === tier
                    ? 'border-slate-300 bg-slate-100 text-slate-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                {TIER_LABELS[tier]}
              </button>
            ))}
          </div>
        </div>

        {/* 카드 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredCards.length === 0 ? (
            <div className="text-center py-12">
              {cards.length === 0 ? (
                <>
                  <p className="text-slate-400 text-sm">아직 카드가 없어요.</p>
                  <a href="/" className="text-indigo-600 hover:text-indigo-700 text-xs mt-2 block">
                    첫 카드 만들기 →
                  </a>
                </>
              ) : (
                <p className="text-slate-400 text-sm">검색 결과가 없어요.</p>
              )}
            </div>
          ) : (
            filteredCards.map((card) => {
              const connCount = connCountMap[card.id] || 0
              const tier = getConnTier(connCount)
              const createdAt = card.created_at?.toDate?.()
              const dateStr = createdAt
                ? createdAt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                : ''

              return (
                <button
                  key={card.id}
                  onClick={() => handleCardListClick(card)}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-slate-50 transition-colors group mb-1"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: TIER_COLORS[tier] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800 font-medium truncate group-hover:text-indigo-600 transition-colors">
                        {card.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{dateStr}</span>
                        {connCount > 0 && (
                          <span className="text-xs" style={{ color: TIER_COLORS[tier] }}>
                            연결 {connCount}
                          </span>
                        )}
                      </div>
                    </div>
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
              <p className="text-slate-400 text-xs">카드를 2개 이상 만들면 그래프가 생겨요.</p>
            </div>
          </div>
        ) : (
          <>
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={graphSize.width}
              height={graphSize.height}
              backgroundColor="#f8fafc"
              nodeCanvasObject={paintNode}
              nodePointerAreaPaint={paintNodePointerArea}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              linkColor={() => '#cbd5e1'}
              linkWidth={1.5}
              linkLabel="reason"
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.003}
              linkDirectionalParticleColor={() => '#94a3b8'}
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />

            {/* 범례 */}
            <div className="absolute bottom-4 left-4 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <p className="text-[10px] text-slate-400 font-medium mb-1.5">연결 수</p>
              <div className="space-y-1">
                {TIER_COLORS.map((color, tier) => (
                  <div key={tier} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-slate-500">{TIER_LABELS[tier]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 힌트 */}
            <div className="absolute bottom-4 right-4 text-xs text-slate-400 select-none">
              스크롤로 줌 · 드래그로 이동 · 클릭으로 카드 열기
            </div>
          </>
        )}
      </div>
    </div>
  )
}
