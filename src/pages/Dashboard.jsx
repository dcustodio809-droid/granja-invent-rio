import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, listItems, listMaterials } from '../lib/data'
import { CATEGORY_EMOJI, CATEGORY_ICON_COMPONENTS } from '../components/CategoryIcons'

export default function Dashboard() {
  const [items, setItems] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([listItems(), listMaterials()])
      .then(([i, m]) => {
        setItems(i)
        setMaterials(m)
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

      {lowStock.length > 0 && (
        <>
          <div className="section-title">NOTIFICAÇÕES · ESTOQUE ABAIXO DO MÍNIMO</div>
          <div className="alert-list" style={{ marginBottom: 24 }}>
            {lowStock.map((m) => (
              <Link key={m.id} to="/estoque" className="alert-row">
                <span className="alert-dot" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="alert-row-title">{m.name}</div>
                  <div className="alert-row-sub">{m.qty} {m.unit} em estoque · mínimo de {m.min_qty} {m.unit}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="section-title">POR CATEGORIA</div>
      <div className="category-grid">
        {categoryCounts.map((c) => {
          const Icon = CATEGORY_ICON_COMPONENTS[c.value]
          const emoji = CATEGORY_EMOJI[c.value]
          return (
            <Link key={c.value} to={`/inventario?categoria=${c.value}`} className="category-card">
              <div className="category-card-icon">
                {Icon ? <Icon width={44} height={44} /> : <span className="category-card-emoji">{emoji}</span>}
              </div>
              <div className="category-card-count">{c.count}</div>
              <div className="category-card-label">{c.label}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
