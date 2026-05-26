import { useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const PAGE_NAMES: Record<string, string> = {
  '/setup': 'Setup',
  '/source': 'Fonte',
  '/queue': 'Fila',
}

interface HeaderProps {
  actions?: React.ReactNode
}

export function Header({ actions }: HeaderProps) {
  const location = useLocation()
  const pathBase = '/' + location.pathname.split('/')[1]
  const pageName = PAGE_NAMES[pathBase] ?? 'Studio'

  return (
    <header className="h-14 border-b border-neutral-200 bg-white flex items-center px-6 justify-between shrink-0">
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        <span className="font-semibold text-neutral-900">PostCraft</span>
        <ChevronRight className="w-4 h-4" />
        <span>{pageName}</span>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
