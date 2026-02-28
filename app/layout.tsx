import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'T-AIO — Threads All-In-One',
  description: 'Threads 콘텐츠 자동화 도구',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="bg-orb orb1" />
        <div className="bg-orb orb2" />
        <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
          <Sidebar />
          <main style={{ flex: 1, padding: '24px', overflowY: 'auto', marginLeft: 'var(--sidebar-w)' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
