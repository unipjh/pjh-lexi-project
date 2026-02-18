export default function ChatBubble({ role, content }) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700'
          }
        `}
      >
        {!isUser && (
          <p className="text-xs text-indigo-400 font-medium mb-1">LEXI AI</p>
        )}
        {content}
      </div>
    </div>
  )
}
