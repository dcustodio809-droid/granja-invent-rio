import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

const TOGGLES = [
  { key: 'notif_low_stock', title: 'Notificações de estoque baixo', desc: 'Avisar quando um material atingir o mínimo' },
  { key: 'auto_sync', title: 'Sincronização automática', desc: 'Manter os dados sempre atualizados' },
  { key: 'biometric_login', title: 'Login por biometria', desc: 'Entrar usando digital ou reconhecimento facial' },
  { key: 'weekly_report', title: 'Exportar relatórios semanais', desc: 'Enviar um resumo em PDF toda semana' },
]

export default function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  async function toggle(key) {
    if (!profile) return
    await supabase.from('profiles').update({ [key]: !profile[key] }).eq('id', user.id)
    refreshProfile()
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <button className="back-link" onClick={() => navigate(-1)}>&larr; Voltar</button>
      <div className="page-header"><div className="page-title">Configurações</div></div>

      <div className="card">
        {TOGGLES.map((t) => (
          <div className="toggle-row" key={t.key}>
            <div>
              <div className="toggle-row-title">{t.title}</div>
              <div className="toggle-row-desc">{t.desc}</div>
            </div>
            <button className={'toggle' + (profile?.[t.key] ? ' on' : '')} onClick={() => toggle(t.key)}>
              <span className="toggle-knob" />
            </button>
          </div>
        ))}
      </div>

      <button className="btn" style={{ width: '100%', marginTop: 20, background: 'var(--bg-tint)', color: 'var(--red)' }} onClick={handleSignOut}>
        Sair da conta
      </button>
    </div>
  )
}
