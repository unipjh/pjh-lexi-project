import { useState } from 'react'

// 소분류 개념 아래에 붙는 접이식 인사이트 입력 컴포넌트
// Props:
//   conceptName     — 상위 개념명 (저장 키로 사용)
//   subConceptName  — 소분류 개념명
//   value           — 현재 인사이트 텍스트
//   onChange        — (newValue: string) => void
export default function InsightToggle({ conceptName, subConceptName, value, onChange }) {
  const [isOpen, setIsOpen] = useState(!!value)

  const hasContent = !!value?.trim()

  // 접힌 상태
  if (!isOpen) {
    return (
      <div className="mt-1.5 ml-1">
        {hasContent ? (
          // 내용 있을 때: 미리보기 클릭으로 펼치기
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-start gap-1.5 text-left group w-full"
          >
            <span className="text-indigo-400 text-xs mt-0.5 shrink-0">💡</span>
            <span className="text-xs text-indigo-600 group-hover:text-indigo-500 leading-relaxed line-clamp-2 transition-colors">
              {value}
            </span>
          </button>
        ) : (
          // 내용 없을 때: 추가 버튼
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-500 transition-colors"
          >
            <span className="text-[10px]">+</span>
            <span>Insight 추가</span>
          </button>
        )}
      </div>
    )
  }

  // 펼친 상태
  return (
    <div className="mt-2 ml-1 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
          💡 Insight — {subConceptName}
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600 text-xs leading-none transition-colors"
          title="접기"
        >
          ▲
        </button>
      </div>
      <textarea
        autoFocus
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${subConceptName}에 대해 떠오르는 생각이나 연결점을 자유롭게...`}
        className="w-full bg-white border border-indigo-100 text-slate-800 rounded-md px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 placeholder:text-slate-400 min-h-[72px] leading-relaxed"
      />
    </div>
  )
}
