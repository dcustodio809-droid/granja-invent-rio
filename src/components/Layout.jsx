import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Início' },
  { to: '/itens', label: 'Itens' },
  { to: '/estoque', label: 'Estoque' },
  { to: '/perfil', label: 'Perfil' },
]

function initials(name) {
  if (!name) return '??'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export default function Layout() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="logo" width={24} height={24} />
          </div>
          <div className="sidebar-brand-name">Granja Lucyara Dumont</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => 'sidebar-nav-item' + (isActive ? ' active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar-circle">{initials(profile?.full_name || user?.email)}</div>
          <div className="sidebar-user">
            <div className="sidebar-user-name">{profile?.full_name || user?.email}</div>
            <div className="sidebar-user-role">{profile?.role === 'gestor' ? 'Gestor de Operações' : 'Funcionário'}</div>
          </div>
        </div>
        <button className="btn btn-secondary sidebar-logout" onClick={handleSignOut}>Sair</button>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => 'bottom-nav-item' + (isActive ? ' active' : '')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
