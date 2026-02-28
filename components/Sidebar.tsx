'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', icon: '⬛', label: '대시보드' },
  { href: '/posts', icon: '✏️', label: '포스트' },
  { href: '/products', icon: '🔗', label: '제품 링크' },
  { href: '/accounts', icon: '👤', label: '계정 관리' },
  { href: '/strategy', icon: '🧠', label: '전략 설정' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      width: 'var(--sidebar-w)',
      background: 'rgba(15,23,41,0.95)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 18px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
          T-AIO
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 2 }}>Threads All-In-One</div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(({ href, icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--primary)' : 'var(--text-s)',
                background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s',
                marginBottom: 2,
              }}
            >
              <span style={{ fontSize: 15 }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-m)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="pulse" />
          로컬 스토리지 모드
        </div>
      </div>
    </aside>
  )
}
