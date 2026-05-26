import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { SetupPage } from '@/pages/SetupPage'
import { SourcePage } from '@/pages/SourcePage'
import { QueuePage } from '@/pages/QueuePage'
import { StudioPage } from '@/pages/StudioPage'
import { GoogleAuthCallback } from '@/pages/GoogleAuthCallback'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/google" element={<GoogleAuthCallback />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/setup" replace />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="source" element={<SourcePage />} />
          <Route path="queue" element={<QueuePage />} />
          <Route path="studio/:id" element={<StudioPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
