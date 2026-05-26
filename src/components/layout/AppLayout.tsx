import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="flex h-screen bg-neutral-50">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-20 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
