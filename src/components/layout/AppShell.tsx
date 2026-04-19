import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: '复习看板', shortLabel: '看', end: true },
  { to: '/libraries', label: '题库', shortLabel: '库' },
  { to: '/practice', label: '练习', shortLabel: '练' },
  { to: '/exam', label: '考试', shortLabel: '考' },
  { to: '/settings', label: '设置', shortLabel: '设' },
]

export function AppShell() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')

    const sync = () => {
      const mobile = mediaQuery.matches
      setIsMobile(mobile)

      if (!mobile) {
        setMobileMenuOpen(false)
      }
    }

    sync()
    mediaQuery.addEventListener('change', sync)

    return () => {
      mediaQuery.removeEventListener('change', sync)
    }
  }, [])

  const handleNavClick = () => {
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }

  const shellClassName = isMobile
    ? 'app-shell mobile'
    : sidebarExpanded
      ? 'app-shell'
      : 'app-shell collapsed'

  const sidebarClassName = [
    'app-sidebar',
    !sidebarExpanded && !isMobile ? 'collapsed' : '',
    isMobile ? 'mobile' : '',
    isMobile && mobileMenuOpen ? 'mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClassName}>
      {isMobile && mobileMenuOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="关闭菜单"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <aside className={sidebarClassName}>
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark">MQ</span>
            {sidebarExpanded || isMobile ? (
              <div>
                <div className="brand-title">MdQuiz</div>
                <div className="brand-subtitle">Local-first Markdown Quiz</div>
              </div>
            ) : null}
          </div>

          {isMobile ? (
            <button
              type="button"
              className="sidebar-toggle"
              aria-label="关闭菜单"
              onClick={() => setMobileMenuOpen(false)}
            >
              ×
            </button>
          ) : (
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={sidebarExpanded ? '折叠侧栏' : '展开侧栏'}
              onClick={() => setSidebarExpanded((value) => !value)}
            >
              {sidebarExpanded ? '←' : '→'}
            </button>
          )}
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              onClick={handleNavClick}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              {sidebarExpanded || isMobile ? item.label : item.shortLabel}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="app-main">
        {isMobile ? (
          <div className="mobile-topbar">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="打开菜单"
              onClick={() => setMobileMenuOpen(true)}
            >
              菜单
            </button>
            <div className="mobile-topbar-title">MdQuiz</div>
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  )
}
