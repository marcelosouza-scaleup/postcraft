import { NavLink } from 'react-router-dom'
import { Settings, Database, ListVideo, Layers, Wand2 } from 'lucide-react'
import { useQueueStore } from '@/stores/useQueueStore'
import { cn } from '@/utils/cn'

const STATIC_NAV = [
  { to: '/setup',  icon: Settings,  label: 'Setup' },
  { to: '/source', icon: Database,  label: 'Fonte' },
  { to: '/queue',  icon: ListVideo, label: 'Fila'  },
]

export function Sidebar() {
  const posts = useQueueStore((s) => s.posts)
  const doneCount = posts.filter((p) => p.status === 'done').length
  const firstDone = posts.find((p) => p.status === 'done')

  const isStudio = (path: string) => path.startsWith('/studio')

  return (
    <aside className="fixed left-0 top-0 h-full w-20 bg-neutral-900 flex flex-col items-center py-4 gap-1 z-50 border-r border-neutral-800">
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center mb-5 shrink-0">
        <Layers className="w-5 h-5 text-white" />
      </div>

      {STATIC_NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'relative w-14 flex flex-col items-center gap-1 py-2 rounded-xl transition-colors',
              isActive
                ? 'bg-orange-600 text-white'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            )
          }
        >
          <div className="relative">
            <Icon className="w-5 h-5" />
            {label === 'Fila' && doneCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-400 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                {doneCount > 9 ? '9+' : doneCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium leading-none">{label}</span>
        </NavLink>
      ))}

      {/* Studio — navega para o primeiro post pronto, ou para /queue */}
      <NavLink
        to={firstDone ? `/studio/${firstDone.id}` : '/queue'}
        className={({ isActive: _isActive }) => {
          const active = isStudio(window.location.pathname)
          return cn(
            'relative w-14 flex flex-col items-center gap-1 py-2 rounded-xl transition-colors',
            active
              ? 'bg-orange-600 text-white'
              : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
          )
        }}
      >
        <Wand2 className="w-5 h-5" />
        <span className="text-[10px] font-medium leading-none">Studio</span>
      </NavLink>
    </aside>
  )
}
