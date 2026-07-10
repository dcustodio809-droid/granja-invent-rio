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
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let photo_url = null
      if (photo) photo_url = await uploadFile(photo, 'items')
      await createItem({
        name,
        category,
        brand,
        serial,
        qty: Number(qty) || 1,
        location,
        description,
        photo_url,
        created_by: userId,
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-sheet" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
        <div className="modal-title">Novo item</div>
        <div className="modal-sub">Cadastre um equipamento, veículo, máquina ou ferramenta</div>

        <label className="field-label">Nome</label>
        <input className="input" style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} required />

        <label className="field-label">Categoria</label>
        <select className="input" style={{ marginBottom: 12 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <div className="field-grid">
          <div>
            <label className="field-label">Marca</label>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Nº de série</label>
            <input className="input mono" value={serial} onChange={(e) => setSerial(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Quantidade</label>
            <input className="input" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Localização</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>

        <label className="field-label">Descrição</label>
        <textarea className="input" style={{ height: 70, paddingTop: 10, marginBottom: 12 }} value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className={'dropzone' + (photo ? ' attached' : '')}>
          {photo ? `Foto selecionada: ${photo.name}` : 'ANEXAR FOTO'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
        </label>

        {error && <div className="login-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
