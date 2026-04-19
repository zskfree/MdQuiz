import { RouterProvider } from 'react-router-dom'
import { AppBootstrap } from './AppBootstrap'
import { router } from './router'

export function App() {
  return (
    <>
      <AppBootstrap />
      <RouterProvider router={router} />
    </>
  )
}
