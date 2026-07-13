import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CATEGORIES, categoryLabel, createItem, listItems, maintenanceStatus } from '../lib/data'
import { uploadFile } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Items() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [params, setParams] = useSearchParams()
  const [showAdd, setShowAdd] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const activeCategory = params.get('categoria') || 'todos'

  function load() {
    setLoading(true)
    listItems().then(setItems).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (activeCategory !== 'todos' && i.category !== activeCategory) return false
      if (search && !`${i.name} ${i.serial} ${i.brand}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [items, activeCategory, search])

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Itens</div>
          <div className="page-subtitle">{filtered.length} item(ns)</div>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Buscar equipamento, peça, número de série..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="chip-row">
        <button
          className={'chip' + (activeCategory === 'todos' ? ' active' : '')}
          onClick={() => setParams({})}
        >
          Todos
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            className={'chip' + (activeCategory === c.value ? ' active' : '')}
            onClick={() => setParams({ categoria: c.value })}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-hint">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-hint">Nenhum item encontrado.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Item</th>
                <th>Categoria</th>
                <th>Marca</th>
                <th>Nº Série</th>
                <th>Qtd</th>
                <th>Localização</th>
                <th>Manutenção</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const status = maintenanceStatus(item.maintenance_due)
                return (
                  <tr key={item.id} onClick={() => navigate(`/itens/${item.id}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      {item.photo_url ? (
                        <img className="table-photo" src={item.photo_url} alt="" />
                      ) : (
                        <div className="table-photo" />
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>{item.name}</td>
                    <td>{categoryLabel(item.category)}</td>
                    <td>{item.brand}</td>
                    <td className="mono">{item.serial}</td>
                    <td>{item.qty}</td>
                    <td>{item.location}</td>
                    <td>{status && status.key !== 'ok' && <span className={'status-pill ' + status.key}>{status.label}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <button className="fab" onClick={() => setShowAdd(true)}>+</button>

      {showAdd && (
        <AddItemModal
          userId={user?.id}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function AddItemModal({ onClose, onCreated, userId }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('equipamento')
  const [brand, setBrand] = useState('')
  const [serial, setSerial] = useState('')
  const [qty, setQty] = useState(1)
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto]
