import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

// Cada pantalla en su propio chunk: el celular no descarga el proyector ni el panel.
const Pantalla = lazy(() => import('./pages/Pantalla'))
const Jugar = lazy(() => import('./pages/Jugar'))
const Admin = lazy(() => import('./pages/Admin'))
const NoEncontrada = lazy(() => import('./pages/NoEncontrada'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/pantalla/:codigo" element={<Pantalla />} />
        <Route path="/jugar/:codigo" element={<Jugar />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="*" element={<NoEncontrada />} />
      </Routes>
    </Suspense>
  )
}
