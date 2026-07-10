import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoryLabel, listItems, maintenanceStatus, markMaintenanceDone } from '../lib/data'

export default function Maintenance() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  function load() {
    setLoading(true)
    listItems().then(setItems).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const rows = useMemo(() => {
    return items
      .filter((i) => i.maintenance_due)
      .map((i) => ({ item: i, status: maintenanceStatus(i.maintenance_due) }))
      .sort((a, b) => {
        const order = { overdue: 0, soon: 1, ok: 2 }
        return order[a.status.key] - order[b.status.key]
      })
  }, [items])

  async function handleDone(item, e) {
    e.stopPropagation()
    await markMaintenanceDone(item)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Manutenções</div>
          <div className="page-subtitle">{rows.length} item(ns) com manutenção programada</div>
        </div>
      </div>

      {loading ? (
        <div className="empty-hint">Carregando...</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Item</th><th>Categoria</th><th>Última manutenção</th><th>Próxima manutenção</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(({ item, status }) => (
                <tr key={item.id} onClick={() => navigate(`/itens/${item.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 700 }}>{item.name}</td>
                  <td>{categoryLabel(item.category)}</td>
                  <td>{item.last_maintenance || 'sem registro'}</td>
                  <td>{item.maintenance_due}</td>
                  <td><span className={'status-pill ' + status.key}>{status.label}</span></td>
                  <td>
                    <button className="btn btn-dark" style={{ height: 34, padding: '0 12px' }} onClick={(e) => handleDone(item, e)}>
                      Marcar como realizada
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="empty-hint">Nenhuma manutenção programada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
