import { useState } from 'react'

export default function ConceptEditor({ concepts, onChange }) {
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  function handleDelete(index) {
    onChange(concepts.filter((_, i) => i !== index))
  }

  function handleStartEdit(index) {
    setEditingIndex(index)
    setEditName(concepts[index].name)
    setEditDesc(concepts[index].description)
  }

  function handleSaveEdit(index) {
    const updated = concepts.map((c, i) =>
      i === index ? { name: editName, description: editDesc } : c
    )
    onChange(updated)
    setEditingIndex(null)
  }

  function handleAdd() {
    if (!newName.trim()) return
    onChange([...concepts, { name: newName.trim(), description: newDesc.trim() }])
    setNewName('')
    setNewDesc('')
  }

  return (
    <div className="space-y-3">
      {concepts.map((concept, i) => (
        <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          {editingIndex === i ? (
            <div className="space-y-2">
              <input
                className="w-full bg-slate-700 text-white rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="개념명"
              />
              <input
                className="w-full bg-slate-700 text-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="한 줄 설명"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingIndex(null)}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSaveEdit(i)}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{concept.name}</p>
                <p className="text-sm text-slate-400 mt-0.5">{concept.description}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleStartEdit(i)}
                  className="text-slate-500 hover:text-slate-300 p-1 rounded text-xs"
                >
                  편집
                </button>
                <button
                  onClick={() => handleDelete(i)}
                  className="text-slate-500 hover:text-red-400 p-1 rounded text-xs"
                >
                  삭제
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 개념 추가 */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 border-dashed space-y-2">
        <p className="text-xs text-slate-500 font-medium">직접 추가</p>
        <input
          className="w-full bg-slate-700 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="개념명"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <input
          className="w-full bg-slate-700 text-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="한 줄 설명 (선택)"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded w-full"
        >
          + 추가
        </button>
      </div>
    </div>
  )
}
