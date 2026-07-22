import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CATEGORIES, categoryLabel, createItem, deleteItems, listItems } from '../lib/data'
import { uploadFile } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import PrintReport from '../components/PrintReport'
import ImageCropper from '../components/ImageCropper'

const COLUMNS = [
  { key: 'name', label: 'Item' },
  { key: 'category', label: 'Categoria' },
  { key: 'brand', label: 'Marca' },
  { key: 'identifier', label: 'Placa / Nº Série' },
  { key: 'qty', label: 'Qtd' },
  { key: 'location', label: 'Localização' },
]

function identifierOf(item) {
  return item.category === 'veiculo' ? (item.plate || '') : (item.serial || '')
}

export default function Items() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [params, setParams] = useSearchParams()
  const [showAdd, setShowAdd] = useState(false)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [selected, setSelected] = useState(new Set())
  const navigate = useNavigate()
  const { user } = useAuth()

  const activeCategory = params.get('categoria') || 'todos'
  const activeLocation = params.get('local') || 'todas'
  const [showFilters, setShowFilters] = useState(false)

  function load() {
    setLoading(true)
    listItems().then(setItems).finally(() => setLoading(false))
  }

  useEffect(load, [])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(ids) {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)))
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return
    if (!window.confirm(`Excluir ${selected.size} item(ns) selecionado(s)? Essa ação não pode ser desfeita.`)) return
    await deleteItems([...selected])
    setSelected(new Set())
    load()
  }

  const locations = useMemo(
    () => [...new Set(items.map((i) => i.location).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items]
  )

  const filtered = useMemo(() => {
    let list = items.filter((i) => {
      if (activeCategory !== 'todos' && i.category !== activeCategory) return false
      if (activeLocation !== 'todas' && i.location !== activeLocation) return false
      if (search && !`${i.name} ${i.serial} ${i.plate} ${i.brand}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let va, vb
      if (sortKey === 'category') {
        va = categoryLabel(a.category)
        vb = categoryLabel(b.category)
      } else if (sortKey === 'identifier') {
        va = identifierOf(a)
        vb = identifierOf(b)
      } else if (sortKey === 'qty') {
        va = Number(a.qty) || 0
        vb = Number(b.qty) || 0
      } else {
        va = (a[sortKey] || '').toString().toLowerCase()
        vb = (b[sortKey] || '').toString().toLowerCase()
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, activeCategory, activeLocation, search, sortKey, sortDir])

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Inventário</div>
          <div className="page-subtitle">{filtered.length} item(ns){selected.size > 0 ? ` · ${selected.size} selecionado(s)` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {selected.size > 0 && (
            <button className="btn" style={{ background: 'var(--bg-tint)', color: 'var(--red)' }} onClick={handleDeleteSelected}>
              Excluir selecionados ({selected.size})
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => window.print()}>Gerar relatório PDF</button>
        </div>
      </div>

      <div className="toolbar" style={{ position: 'relative' }}>
        <input
          className="search-input"
          placeholder="Buscar equipamento, peça, número de série ou placa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={'btn btn-secondary' + (activeCategory !== 'todos' || activeLocation !== 'todas' ? ' filter-btn-active' : '')}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filtros{(activeCategory !== 'todos' || activeLocation !== 'todas') ? ' •' : ''}
        </button>

        {showFilters && (
          <div className="filter-balloon">
            <div className="field-label">Categoria</div>
            <select
              className="input"
              style={{ marginBottom: 14 }}
              value={activeCategory}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                if (e.target.value === 'todos') next.delete('categoria')
                else next.set('categoria', e.target.value)
                setParams(next)
              }}
            >
              <option value="todos">Todas as categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            <div className="field-label">Localização</div>
            <select
              className="input"
              style={{ marginBottom: 16 }}
              value={activeLocation}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                if (e.target.value === 'todas') next.delete('local')
                else next.set('local', e.target.value)
                setParams(next)
              }}
            >
              <option value="todas">Todas as localizações</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            <div className="modal-actions" style={{ marginTop: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setParams({})}>Limpar filtros</button>
              <button type="button" className="btn btn-primary" onClick={() => setShowFilters(false)}>Aplicar</button>
            </div>
          </div>
        )}
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
                <th className="select-col">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={() => toggleAll(filtered.map((i) => i.id))}
                  />
                </th>
                <th>Foto</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="sortable-th" onClick={() => handleSort(col.key)}>
                    {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} onClick={() => navigate(`/inventario/${item.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="select-col" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} />
                  </td>
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
                  <td className="mono">{identifierOf(item) || '—'}</td>
                  <td>{item.qty}</td>
                  <td>{item.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PrintReport
        title="Relatório de Inventário"
        columns={[
          { key: 'name', label: 'Item' },
          { key: 'category', label: 'Categoria', render: (r) => categoryLabel(r.category) },
          { key: 'brand', label: 'Marca' },
          { key: 'identifier', label: 'Placa / Nº Série', render: (r) => identifierOf(r) || '—' },
          { key: 'qty', label: 'Qtd' },
          { key: 'location', label: 'Localização' },
        ]}
        rows={selected.size > 0 ? filtered.filter((i) => selected.has(i.id)) : filtered}
      />

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
  const [plate, setPlate] = useState('')
  const [renavam, setRenavam] = useState('')
  const [chassi, setChassi] = useState('')
  const [qty, setQty] = useState(1)
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isVehicle = category === 'veiculo'

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCropSrc({ url: URL.createObjectURL(file), name: file.name })
  }

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
        serial: isVehicle ? '' : serial,
        plate: isVehicle ? plate : null,
        renavam: isVehicle ? renavam : null,
        chassi: isVehicle ? chassi : null,
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

          {isVehicle ? (
            <>
              <div>
                <label className="field-label">Placa</label>
                <input className="input mono" value={plate} onChange={(e) => setPlate(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Renavam</label>
                <input className="input mono" value={renavam} onChange={(e) => setRenavam(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Chassi</label>
                <input className="input mono" value={chassi} onChange={(e) => setChassi(e.target.value)} />
              </div>
            </>
          ) : (
            <div>
              <label className="field-label">Nº de série</label>
              <input className="input mono" value={serial} onChange={(e) => setSerial(e.target.value)} />
            </div>
          )}

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
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
        </label>

        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc.url}
            fileName={cropSrc.name}
            onCancel={() => setCropSrc(null)}
            onConfirm={(file) => {
              setPhoto(file)
              setCropSrc(null)
            }}
          />
        )}

        {error && <div className="login-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
