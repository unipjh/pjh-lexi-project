import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 h-14 flex items-center px-6">
      <NavLink to="/" className="text-slate-900 font-bold text-lg tracking-tight mr-8">
        LEXI
      </NavLink>
      <div className="flex gap-6">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `text-sm font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          + 새 카드
        </NavLink>
        <NavLink
          to="/graph"
          className={({ isActive }) =>
            `text-sm font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          탐색
        </NavLink>
      </div>
    </nav>
  )
}
