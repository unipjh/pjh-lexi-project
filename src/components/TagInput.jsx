import { useState, useRef } from 'react'

// Notion Select 스타일 태그 입력 컴포넌트
// Props:
//   tags        — 현재 태그 배열 (string[])
//   onChange    — (newTags: string[]) => void
//   placeholder — 입력 placeholder
const TAG_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function getTagColor(tag) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

export default function TagInput({ tags = [], onChange, placeholder = '태그 추가 (Enter 또는 ,)' }) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  function addTag(raw) {
    const tag = raw.trim()
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
      setInputValue('')
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function handleChange(e) {
    const val = e.target.value
    // 쉼표 입력 시 즉시 태그 추가
    if (val.endsWith(',')) {
      addTag(val.slice(0, -1))
      setInputValue('')
    } else {
      setInputValue(val)
    }
  }

  function removeTag(tag) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 items-center min-h-[36px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg cursor-text focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 transition-colors"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${getTagColor(tag)}`}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
            className="opacity-60 hover:opacity-100 leading-none transition-opacity"
            aria-label={`${tag} 태그 제거`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] text-xs text-slate-700 bg-transparent outline-none placeholder:text-slate-400"
      />
    </div>
  )
}
