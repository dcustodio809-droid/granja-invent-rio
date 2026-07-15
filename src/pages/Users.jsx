import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Users() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setProfiles(data || [])
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function changeRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Usuários</div>
          <div className="page-subtitle">{profiles.length} usuário(s) com acesso ao sistema</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
        Para cadastrar um novo funcionário: acesse o Supabase → <strong>Authentication → Users → Add user</strong>,
        informe e-mail e senha. Assim que a pessoa fizer login pela primeira vez, ela aparece automaticamente
        nesta lista e você pode definir o cargo dela abaixo.
      </div>

      {error && <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>{error}</div>}

      {loading ? (
        <div className="empty-hint">Carregando...</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Cargo</th></tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.full_name || '—'}</td>
                  <td>{p.email || '—'}</td>
                  <td>
                    <select
                      className="input"
                      style={{ height: 38, width: 170 }}
                      value={p.role}
                      onChange={(e) => changeRole(p.id, e.target.value)}
                    >
                      <option value="funcionario">Funcionário</option>
                      <option value="gestor">Gestor</option>
                    </select>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && <tr><td colSpan={3} className="empty-hint">Nenhum usuário encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
