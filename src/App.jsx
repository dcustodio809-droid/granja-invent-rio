import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import ItemDetail from './pages/ItemDetail'
import Stock from './pages/Stock'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Users from './pages/Users'
import Audit from './pages/Audit'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="empty-hint" style={{ padding: 40 }}>Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function GestorRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="empty-hint" style={{ padding: 40 }}>Carregando...</div>
  if (profile?.role !== 'gestor') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="inventario" element={<Items />} />
        <Route path="inventario/:id" element={<ItemDetail />} />
        <Route path="estoque" element={<Stock />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="usuarios" element={<GestorRoute><Users /></GestorRoute>} />
        <Route path="auditoria" element={<GestorRoute><Audit /></GestorRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
