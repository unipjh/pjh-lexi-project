import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const SCALE = 1.5

// source_text와 매칭되는 text items 반환
function findMatchingItems(textContent, sourceText) {
  if (!sourceText?.trim() || !textContent?.items?.length) return []

  const items = textContent.items.filter((item) => item.str?.trim())
  if (!items.length) return []

  // 각 item의 문자 범위를 추적하며 전체 텍스트 구성
  const segments = []
  let pos = 0
  for (const item of items) {
    segments.push({ start: pos, end: pos + item.str.length, item })
    pos += item.str.length + 1 // 아이템 사이 공백 1칸
  }
  const fullText = items.map((item) => item.str).join(' ')

  // source_text의 공백을 유연하게 매칭 (줄바꿈 포함)
  let match
  try {
    const escaped = sourceText
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+')
    match = fullText.match(new RegExp(escaped, 'i'))
  } catch {
    return []
  }
  if (!match) return []

  const matchStart = match.index
  const matchEnd = matchStart + match[0].length

  return segments
    .filter((s) => s.start < matchEnd && s.end > matchStart)
    .map((s) => s.item)
}

// PDF item → canvas 기준 % 좌표 rect 변환
function itemToRect(item, viewport) {
  const tx = item.transform[4]
  const ty = item.transform[5]
  const [vx, vy] = viewport.convertToViewportPoint(tx, ty)

  const w = item.width * SCALE
  const h = (item.height > 0 ? item.height : Math.abs(item.transform[3])) * SCALE

  return {
    xPct: vx / viewport.width,
    yPct: (vy - h) / viewport.height,
    wPct: w / viewport.width,
    hPct: h / viewport.height,
  }
}

// 같은 줄의 인접 rect를 병합해서 끊김 없는 하이라이트 블록으로 만들기
function mergeRectsOnSameLine(overlays) {
  if (!overlays.length) return []

  // 1. yPct 기준 그룹화 (tolerance: 0.008)
  const groups = []
  for (const o of overlays) {
    const group = groups.find(
      (g) => g.color === o.color && g.concept_name === o.concept_name && Math.abs(g.yRef - o.yPct) < 0.008
    )
    if (group) {
      group.items.push(o)
    } else {
      groups.push({ yRef: o.yPct, color: o.color, concept_name: o.concept_name, items: [o] })
    }
  }

  // 2. 그룹 내 xPct 오름차순 정렬 후 인접 rect 병합 (gap ≤ 0.015)
  const merged = []
  for (const group of groups) {
    const sorted = [...group.items].sort((a, b) => a.xPct - b.xPct)
    let current = { ...sorted[0] }
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]
      if (next.xPct - (current.xPct + current.wPct) <= 0.015) {
        // 병합: 오른쪽 끝 확장
        const rightEdge = Math.max(current.xPct + current.wPct, next.xPct + next.wPct)
        current.wPct = rightEdge - current.xPct
        current.hPct = Math.max(current.hPct, next.hPct)
      } else {
        merged.push(current)
        current = { ...next }
      }
    }
    merged.push(current)
  }

  return merged
}

// PDF 뷰어 컴포넌트
// Props:
//   file             — File 객체 (PDF)
//   highlights       — [{ source_text, concept_name, color }]
//   activeConceptName — 현재 강조할 개념명 (스크롤 + 강조)
export default function PDFViewer({ file, highlights = [], activeConceptName = null }) {
  const [pageList, setPageList] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isScanOnly, setIsScanOnly] = useState(false)

  useEffect(() => {
    if (!file) return
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setIsScanOnly(false)
      setPageList([])

      try {
        const buf = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise
        const list = []
        let totalTextItems = 0

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          totalTextItems += textContent.items.length
          list.push({ page, textContent, pageNum: i })
        }

        if (!cancelled) {
          setIsScanOnly(totalTextItems === 0)
          setPageList(list)
        }
      } catch (e) {
        console.error('PDF 로딩 오류:', e)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [file])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isScanOnly) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-3xl mb-4">🖼️</div>
        <p className="text-slate-700 font-medium">텍스트 레이어가 없는 PDF입니다</p>
        <p className="text-slate-400 text-sm mt-2">
          스캔본 PDF는 하이라이트를 지원하지 않아요.<br />
          개념 추출은 정상적으로 계속 진행됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full bg-slate-100 px-4 py-4 space-y-3">
      {pageList.map(({ page, textContent, pageNum }) => (
        <PageCanvas
          key={pageNum}
          page={page}
          textContent={textContent}
          pageNum={pageNum}
          highlights={highlights}
          activeConceptName={activeConceptName}
        />
      ))}
    </div>
  )
}

function PageCanvas({ page, textContent, pageNum, highlights, activeConceptName }) {
  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const [overlays, setOverlays] = useState([])
  const [viewport, setViewport] = useState(null)

  // canvas 렌더링 + viewport 저장
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const vp = page.getViewport({ scale: SCALE })
    setViewport(vp)

    canvas.width = vp.width
    canvas.height = vp.height

    const ctx = canvas.getContext('2d')
    const renderTask = page.render({ canvasContext: ctx, viewport: vp })
    renderTask.promise.catch((e) => {
      if (e?.name !== 'RenderingCancelledException') console.error(e)
    })

    return () => renderTask.cancel()
  }, [page])

  // viewport 또는 highlights 변경 시 오버레이 좌표 계산
  useEffect(() => {
    if (!viewport || !highlights?.length) {
      setOverlays([])
      return
    }

    const computed = []
    for (const hl of highlights) {
      if (!hl.source_text?.trim()) continue
      const matchedItems = findMatchingItems(textContent, hl.source_text)
      for (const item of matchedItems) {
        const rect = itemToRect(item, viewport)
        if (rect.wPct > 0 && rect.hPct > 0) {
          computed.push({ ...rect, color: hl.color || '#fde68a', concept_name: hl.concept_name })
        }
      }
    }
    setOverlays(mergeRectsOnSameLine(computed))
  }, [viewport, highlights, textContent])

  // activeConceptName 변경 시 해당 페이지로 스크롤
  useEffect(() => {
    if (!activeConceptName || !overlays.length) return
    const hasMatch = overlays.some((o) => o.concept_name === activeConceptName)
    if (hasMatch) {
      wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeConceptName, overlays])

  return (
    <div ref={wrapperRef} className="bg-white shadow-sm rounded overflow-hidden">
      {/* canvas + 오버레이를 감싸는 relative 컨테이너 */}
      <div className="relative">
        <canvas ref={canvasRef} className="w-full block" />
        {overlays.map((o, i) => {
          const isActive = o.concept_name === activeConceptName
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${o.xPct * 100}%`,
                top: `${o.yPct * 100}%`,
                width: `${o.wPct * 100}%`,
                height: `${o.hPct * 100}%`,
                backgroundColor: o.color,
                opacity: isActive ? 0.65 : 0.45,
                outline: isActive ? `2px solid ${o.color}` : 'none',
                pointerEvents: 'none',
                transition: 'opacity 0.15s',
              }}
            />
          )
        })}
      </div>
      <div className="text-center text-[11px] text-slate-400 py-1.5 border-t border-slate-100">
        {pageNum}
      </div>
    </div>
  )
}
