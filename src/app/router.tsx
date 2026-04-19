import { Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'

const HomePage = lazy(() => import('../pages/home/HomePage').then((module) => ({ default: module.HomePage })))
const LibraryPage = lazy(() =>
  import('../pages/library/LibraryPage').then((module) => ({ default: module.LibraryPage })),
)
const PracticePage = lazy(() =>
  import('../pages/practice/PracticePage').then((module) => ({ default: module.PracticePage })),
)
const ExamPage = lazy(() => import('../pages/exam/ExamPage').then((module) => ({ default: module.ExamPage })))
const DiagnosticsPage = lazy(() =>
  import('../pages/diagnostics/DiagnosticsPage').then((module) => ({ default: module.DiagnosticsPage })),
)
const SettingsPage = lazy(() =>
  import('../pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)

function withSuspense(element: JSX.Element) {
  return <Suspense fallback={<div className="page-loading">页面加载中...</div>}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      { path: 'libraries', element: withSuspense(<LibraryPage />) },
      { path: 'practice', element: withSuspense(<PracticePage />) },
      { path: 'exam', element: withSuspense(<ExamPage />) },
      { path: 'diagnostics', element: withSuspense(<DiagnosticsPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
    ],
  },
])
