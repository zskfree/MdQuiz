import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const navItems = [
  { to: '/', label: '复习看板', end: true },
  { to: '/libraries', label: '题库' },
  { to: '/practice', label: '练习' },
  { to: '/exam', label: '考试' },
  { to: '/settings', label: '设置' },
]

function getCollapsedLabel(label: string): string {
  if (label === '复习看板') {
    return '看板'
  }

  const condensed = label.replace(/\s+/g, '').trim()
  return condensed.slice(0, 2) || label
}

export function AppShell() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const currentPageLabel = navItems.find((item) => {
    if (item.end) {
      return location.pathname === item.to
    }

    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  })?.label

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setIsMobile(false)
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 900px)')

    const sync = () => {
      const mobile = mediaQuery.matches
      setIsMobile(mobile)

      if (!mobile) {
        setMobileMenuOpen(false)
      }
    }

    sync()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', sync)
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(sync)
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', sync)
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(sync)
      }
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
            <span className="brand-mark">刷题</span>
            {sidebarExpanded || isMobile ? (
              <div>
                <div className="brand-title">题库练习</div>
                <div className="brand-subtitle">本地刷题应用</div>
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

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              onClick={handleNavClick}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              {sidebarExpanded || isMobile ? item.label : getCollapsedLabel(item.label)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="app-main">
        {isMobile ? (
          <div className="mobile-topbar">
            <div className="mobile-topbar-main">
              <button
                type="button"
                className="mobile-menu-button"
                aria-label="打开菜单"
                onClick={() => setMobileMenuOpen(true)}
              >
                菜单
              </button>
              <div className="mobile-topbar-title">{currentPageLabel ?? '题库练习'}</div>
            </div>
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  )
}
