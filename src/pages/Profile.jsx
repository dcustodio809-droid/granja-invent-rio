import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function initials(name) {
  if (!name) return '??'
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

export default function Profile() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="page-header"><div className="page-title">Perfil</div></div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div className="avatar-circle" style={{ width: 52, height: 52, fontSize: 18 }}>
          {initials(profile?.full_name || user?.email)}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{profile?.full_name || 'Sem nome cadastrado'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
            {profile?.role === 'gestor' ? 'Gestor de Operações' : 'Funcionário'} · {user?.email}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Link to="/configuracoes" className="profile-row">Configurações</Link>
        <div className="profile-row">Ajuda e suporte</div>
        <div className="profile-row" style={{ color: 'var(--red)', fontWeight: 700 }} onClick={handleSignOut}>Sair</div>
      </div>
    </div>
  )
}
