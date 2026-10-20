import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Recuperable } from './components/Recuperable'

// Cada pantalla en su propio chunk: el celular no descarga el proyector ni el panel.
const Pantalla = lazy(() => import('./pages/Pantalla'))
const Jugar = lazy(() => import('./pages/Jugar'))
const Admin = lazy(() => import('./pages/Admin'))
const NoEncontrada = lazy(() => import('./pages/NoEncontrada'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route
          path="/pantalla/:codigo"
          element={
            <Recuperable fondo="azul">
              <Pantalla />
            </Recuperable>
          }
        />
        <Route
          path="/jugar/:codigo"
          element={
            <Recuperable>
              <Jugar />
            </Recuperable>
          }
        />
        <Route
          path="/admin/*"
          element={
            <Recuperable>
              <Admin />
            </Recuperable>
          }
        />
        <Route path="*" element={<NoEncontrada />} />
      </Routes>
    </Suspense>
  )
}
