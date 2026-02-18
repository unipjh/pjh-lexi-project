import { useState } from 'react'

// 계층 구조 개념 편집 컴포넌트
// Props:
//   concepts — [{name, description, sub_concepts:[{name,description}]}]
//   onChange — (newConcepts) => void
export default function ConceptEditor({ concepts, onChange }) {
  const [editingPath, setEditingPath] = useState(null) // 'parent-i' | 'sub-i-j'
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const [newParentName, setNewParentName] = useState('')
  const [newParentDesc, setNewParentDesc] = useState('')
  const [addingSubFor, setAddingSubFor] = useState(null) // parent index
  const [newSubName, setNewSubName] = useState('')
  const [newSubDesc, setNewSubDesc] = useState('')

  // ── 상위 개념 ──
  function startEditParent(i) {
    setEditingPath(`parent-${i}`)
    setEditName(concepts[i].name)
    setEditDesc(concepts[i].description || '')
  }

  function saveEditParent(i) {
    const updated = concepts.map((c, idx) =>
      idx === i ? { ...c, name: editName, description: editDesc } : c
    )
    onChange(updated)
    setEditingPath(null)
  }

  function deleteParent(i) {
    onChange(concepts.filter((_, idx) => idx !== i))
  }

  function addParent() {
    if (!newParentName.trim()) return
    onChange([...concepts, { name: newParentName.trim(), description: newParentDesc.trim(), sub_concepts: [] }])
    setNewParentName('')
    setNewParentDesc('')
  }

  // ── 하위 개념 ──
  function startEditSub(i, j) {
    setEditingPath(`sub-${i}-${j}`)
    setEditName(concepts[i].sub_concepts[j].name)
    setEditDesc(concepts[i].sub_concepts[j].description || '')
  }

  function saveEditSub(i, j) {
    const updated = concepts.map((c, ci) => {
      if (ci !== i) return c
      return {
        ...c,
        sub_concepts: (c.sub_concepts || []).map((s, si) =>
          si === j ? { name: editName, description: editDesc } : s
        ),
      }
    })
    onChange(updated)
    setEditingPath(null)
  }

  function deleteSub(i, j) {
    const updated = concepts.map((c, ci) => {
      if (ci !== i) return c
      return { ...c, sub_concepts: (c.sub_concepts || []).filter((_, si) => si !== j) }
    })
    onChange(updated)
  }

  function addSub(i) {
    if (!newSubName.trim()) return
    const updated = concepts.map((c, ci) => {
      if (ci !== i) return c
      return {
        ...c,
        sub_concepts: [...(c.sub_concepts || []), { name: newSubName.trim(), description: newSubDesc.trim() }],
      }
    })
    onChange(updated)
    setNewSubName('')
    setNewSubDesc('')
    setAddingSubFor(null)
  }

  function cancelEdit() {
    setEditingPath(null)
    setEditName('')
    setEditDesc('')
  }

  return (
    <div className="space-y-2">
      {concepts.map((concept, i) => (
        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* 상위 개념 행 */}
          {editingPath === `parent-${i}` ? (
            <div className="px-4 py-3 bg-slate-50 space-y-2">
              <input
                autoFocus
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="개념명"
              />
              <input
                className="w-full bg-white border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="한 줄 설명"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1 rounded">취소</button>
                <button onClick={() => saveEditParent(i)} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded">저장</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-semibold text-slate-800 truncate">{concept.name}</span>
                {concept.description && (
                  <span className="text-xs text-slate-400 truncate">{concept.description}</span>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEditParent(i)} className="text-[11px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded">편집</button>
                <button onClick={() => deleteParent(i)} className="text-[11px] text-slate-400 hover:text-red-500 px-1.5 py-0.5 rounded">삭제</button>
              </div>
            </div>
          )}

          {/* 하위 개념 목록 */}
          {(concept.sub_concepts?.length > 0 || addingSubFor === i) && (
            <div className="border-t border-slate-100 bg-slate-50 divide-y divide-slate-100">
              {(concept.sub_concepts || []).map((sub, j) => (
                <div key={j} className="pl-7 pr-3 py-1.5">
                  {editingPath === `sub-${i}-${j}` ? (
                    <div className="space-y-1.5 py-1">
                      <input
                        autoFocus
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="하위 개념명"
                      />
                      <input
                        className="w-full bg-white border border-slate-200 text-slate-600 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="설명"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelEdit} className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded">취소</button>
                        <button onClick={() => saveEditSub(i, j)} className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded">저장</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-slate-400 text-[10px] shrink-0">└</span>
                        <span className="text-xs font-medium text-slate-700 truncate">{sub.name}</span>
                        {sub.description && (
                          <span className="text-[11px] text-slate-400 truncate">{sub.description}</span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEditSub(i, j)} className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded">편집</button>
                        <button onClick={() => deleteSub(i, j)} className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5 rounded">삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* 하위 개념 추가 인풋 */}
              {addingSubFor === i ? (
                <div className="pl-7 pr-3 py-2 space-y-1.5">
                  <input
                    autoFocus
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="하위 개념명"
                    onKeyDown={(e) => e.key === 'Enter' && addSub(i)}
                  />
                  <input
                    className="w-full bg-white border border-slate-200 text-slate-600 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
                    value={newSubDesc}
                    onChange={(e) => setNewSubDesc(e.target.value)}
                    placeholder="설명 (선택)"
                    onKeyDown={(e) => e.key === 'Enter' && addSub(i)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setAddingSubFor(null); setNewSubName(''); setNewSubDesc('') }} className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded">취소</button>
                    <button onClick={() => addSub(i)} disabled={!newSubName.trim()} className="text-[11px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-2 py-0.5 rounded">추가</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSubFor(i)}
                  className="w-full pl-7 pr-3 py-1.5 text-left text-[11px] text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                >
                  + 하위 개념 추가
                </button>
              )}
            </div>
          )}

          {/* 하위 개념이 아예 없을 때 추가 버튼 */}
          {!concept.sub_concepts?.length && addingSubFor !== i && (
            <div className="border-t border-slate-100">
              <button
                onClick={() => setAddingSubFor(i)}
                className="w-full pl-7 pr-3 py-1.5 text-left text-[11px] text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 bg-slate-50 transition-colors"
              >
                + 하위 개념 추가
              </button>
            </div>
          )}
        </div>
      ))}

      {/* 상위 개념 추가 */}
      <div className="border border-dashed border-slate-200 rounded-xl px-4 py-3 bg-slate-50 space-y-2">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">상위 개념 직접 추가</p>
        <input
          className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
          value={newParentName}
          onChange={(e) => setNewParentName(e.target.value)}
          placeholder="개념명"
          onKeyDown={(e) => e.key === 'Enter' && addParent()}
        />
        <input
          className="w-full bg-white border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
          value={newParentDesc}
          onChange={(e) => setNewParentDesc(e.target.value)}
          placeholder="한 줄 설명 (선택)"
          onKeyDown={(e) => e.key === 'Enter' && addParent()}
        />
        <button
          onClick={addParent}
          disabled={!newParentName.trim()}
          className="w-full text-xs bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          + 추가
        </button>
      </div>
    </div>
  )
}
