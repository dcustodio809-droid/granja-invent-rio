import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const TABLE_LABELS = {
  items: 'Itens',
  materials: 'Materiais',
  movements: 'Movimentação',
}

const ACTION_LABELS = {
  insert: 'Criado',
  update: 'Atualizado',
  delete: 'Excluído',
}

function recordLabel(row) {
  const data = row.new_data || row.old_data || {}
  return data.name || data.full_name || row.record_id?.slice(0, 8) || '—'
}

export default function Audit() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [filterTable, setFilterTable] = useState('todos')

  function load() {
    setLoading(true)
    setError('')
    supabase
      .from('audit_log')
      .select('*, profiles(full_name,email)')
      .order('changed_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setLogs(data || [])
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = filterTable === 'todos' ? logs : logs.filter((l) => l.table_name === filterTable)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Auditoria</div>
          <div className="page-subtitle">Histórico de alterações no sistema (últimos 300 registros)</div>
        </div>
      </div>

      <div className="chip-row">
        {['todos', 'items', 'materials', 'movements'].map((t) => (
          <button
            key={t}
            className={'chip' + (filterTable === t ? ' active' : '')}
            onClick={() => setFilterTable(t)}
          >
            {t === 'todos' ? 'Todos' : TABLE_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>{error}</div>}

      {loading ? (
        <div className="empty-hint">Carregando...</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Data/Hora</th><th>Usuário</th><th>Tabela</th><th>Ação</th><th>Registro</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <Fragment key={log.id}>
                  <tr key={log.id}>
                    <td>{new Date(log.changed_at).toLocaleString('pt-BR')}</td>
                    <td>{log.profiles?.full_name || log.profiles?.email || 'Sistema'}</td>
                    <td>{TABLE_LABELS[log.table_name] || log.table_name}</td>
                    <td>
                      <span className={'status-pill ' + (log.action === 'delete' ? 'overdue' : log.action === 'insert' ? 'ok' : 'soon')}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td>{recordLabel(log)}</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ height: 32, padding: '0 12px', fontSize: 11.5 }}
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      >
                        {expanded === log.id ? 'Ocultar' : 'Detalhes'}
                      </button>
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr key={log.id + '-detail'}>
                      <td colSpan={6} style={{ background: 'var(--bg-page)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '8px 4px' }}>
                          <div>
                            <div className="field-label">Antes</div>
                            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {log.old_data ? JSON.stringify(log.old_data, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <div className="field-label">Depois</div>
                            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {log.new_data ? JSON.stringify(log.new_data, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="empty-hint">Nenhum registro de auditoria ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
