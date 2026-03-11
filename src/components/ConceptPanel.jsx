import InsightToggle from './InsightToggle'

// 하이라이트 색상 팔레트 — PDFViewer highlights 배열과 index 기준으로 동기화
const COLORS = [
  '#fde68a', // amber
  '#a7f3d0', // emerald
  '#bfdbfe', // blue
  '#fca5a5', // red
  '#ddd6fe', // violet
  '#fed7aa', // orange
  '#99f6e4', // teal
  '#e9d5ff', // purple
]

// 개념 목록 열람 전용 컴포넌트 (ConceptEditor의 읽기 전용 버전)
// Props:
//   concepts         — [{ name, description, source_text, sub_concepts }]
//   activeConceptName — 현재 활성 개념명 (하이라이트 강조)
//   onConceptClick   — (conceptName: string) => void
//   getInsightContent — (conceptName, subConceptName) => string
//   onInsightChange  — (conceptName, subConceptName, value) => void
export default function ConceptPanel({
  concepts,
  activeConceptName,
  onConceptClick,
  getInsightContent,
  onInsightChange,
}) {
  return (
    <div className="space-y-2">
      {concepts.map((concept, i) => {
        const color = COLORS[i % COLORS.length]
        const isParentActive = activeConceptName === concept.name

        return (
          <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* 상위 개념 헤더 */}
            <button
              onClick={() => onConceptClick(concept.name)}
              className={`w-full text-left px-4 py-2.5 transition-colors flex items-center gap-2 ${
                isParentActive
                  ? 'bg-indigo-50 border-l-4 border-indigo-400'
                  : 'bg-white hover:bg-slate-50 border-l-4 border-transparent'
              }`}
            >
              {/* 개념 색상 도트 */}
              <span
                className="shrink-0 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-semibold text-slate-800">{concept.name}</span>
                {concept.description && (
                  <span className="text-xs text-slate-400 truncate">{concept.description}</span>
                )}
              </div>
            </button>

            {/* 하위 개념 목록 */}
            {concept.sub_concepts?.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50 divide-y divide-slate-100">
                {concept.sub_concepts.map((sub, j) => {
                  const isSubActive = activeConceptName === sub.name

                  return (
                    <div key={j} className="px-4 py-2">
                      <button
                        onClick={() => onConceptClick(sub.name)}
                        className={`w-full text-left flex items-baseline gap-1.5 mb-0.5 rounded px-1 -mx-1 py-0.5 transition-colors ${
                          isSubActive ? 'bg-indigo-100' : 'hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-slate-400 text-[10px] shrink-0">└</span>
                        <span className="text-xs font-medium text-slate-700">{sub.name}</span>
                        {sub.description && (
                          <span className="text-[11px] text-slate-400">{sub.description}</span>
                        )}
                      </button>

                      {/* InsightToggle — 소분류 아래 통합 */}
                      {getInsightContent && onInsightChange && (
                        <div className="pl-3">
                          <InsightToggle
                            conceptName={concept.name}
                            subConceptName={sub.name}
                            value={getInsightContent(concept.name, sub.name)}
                            onChange={(val) => onInsightChange(concept.name, sub.name, val)}
                          />
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
  )
}

// 색상 팔레트를 외부에서도 참조할 수 있도록 export
// PDFViewer highlights 배열 생성 시 index 기준으로 동일한 색상 사용
export { COLORS }
