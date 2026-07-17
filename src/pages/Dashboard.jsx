import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, listItems } from '../lib/data'
import { CATEGORY_ICON_COMPONENTS } from '../components/CategoryIcons'

export default function Dashboard() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    listItems()
      .then(setItems)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const categoryCounts = useMemo(
    () => CATEGORIES.map((c) => ({ ...c, count: items.filter((i) => i.category === c.value).length })),
    [items]
  )

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

      <div className="section-title">POR CATEGORIA</div>
      <div className="category-grid">
        {categoryCounts.map((c) => {
          const Icon = CATEGORY_ICON_COMPONENTS[c.value]
          return (
            <Link key={c.value} to={`/inventario?categoria=${c.value}`} className="category-card">
              <div className="category-card-icon">{Icon && <Icon width={28} height={28} />}</div>
              <div className="category-card-count">{c.count}</div>
              <div className="category-card-label">{c.label}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
