import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, listItems, listMaterials, listMovements } from '../lib/data'

export default function Dashboard() {
  const [items, setItems] = useState([])
  const [materials, setMaterials] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([listItems(), listMaterials(), listMovements()])
      .then(([i, m, mv]) => {
        setItems(i)
        setMaterials(m)
        setMovements(mv)
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const categoryCounts = useMemo(
    () => CATEGORIES.map((c) => ({ ...c, count: items.filter((i) => i.category === c.value).length })),
    [items]
  )

  const lowStock = useMemo(() => materials.filter((m) => Number(m.qty) <= Number(m.min_qty)), [materials])

  if (loading) return <div className="page-header"><div className="page-title">Carregando...</div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Início</div>
          <div className="page-subtitle">Resumo do dia</div>
        </div>
      </div>

      {err && <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>{err}</div>}

      <div className="dark-total-card">
        <div className="eyebrow-dark">TOTAL DE ITENS CADASTRADOS</div>
        <div className="dark-total-value">{items.length}</div>
        <Link to="/itens" className="btn btn-primary" style={{ marginTop: 12, width: 'fit-content' }}>Ver todos</Link>
      </div>

      <div className="section-title">POR CATEGORIA</div>
      <div className="category-grid">
        {categoryCounts.map((c) => (
          <Link key={c.value} to={`/itens?categoria=${c.value}`} className="category-card">
            <div className="category-card-count">{c.count}</div>
            <div className="category-card-label">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="section-title">ESTOQUE DE MATERIAIS</div>
      <div className="alert-list">
        {lowStock.map((m) => (
          <div key={m.id} className="alert-row">
            <span className="alert-dot" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="alert-row-title">{m.name}</div>
              <div className="alert-row-sub">{m.qty} {m.unit} em estoque · abaixo do mínimo</div>
            </div>
          </div>
        ))}
        {lowStock.length === 0 && <div className="empty-hint">Nenhum material abaixo do mínimo.</div>}
        <Link to="/estoque" className="bordered-row">Ver estoque completo</Link>
      </div>
    </div>
  )
}
