import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { categoryLabel, getItem, markMaintenanceDone, maintenanceStatus, updateItem } from '../lib/data'
import { uploadFile } from '../lib/supabaseClient'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    getItem(id).then(setItem).finally(() => setLoading(false))
  }
  useEffect(load, [id])

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    try {
      const photo_url = await uploadFile(file, 'items')
      const updated = await updateItem(id, { photo_url })
      setItem(updated)
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkDone() {
    setSaving(true)
    try {
      const updated = await markMaintenanceDone(item)
      setItem(updated)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !item) return <div className="empty-hint">Carregando...</div>

  const status = maintenanceStatus(item.maintenance_due)

  return (
    <div style={{ maxWidth: 640 }}>
      <button className="back-link" onClick={() => navigate(-1)}>&larr; Voltar</button>

      <label className="detail-photo">
        {item.photo_url ? (
          <img src={item.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
        ) : (
          'ANEXAR FOTO'
        )}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
      </label>

      <span className="pill pill-tint">{categoryLabel(item.category)}</span>
      <div className="detail-name">{item.name}</div>

      <div className="field-grid">
        <div className="detail-field">
          <div className="detail-field-label">Marca</div>
          <div className="detail-field-value">{item.brand || '—'}</div>
        </div>
        <div className="detail-field">
          <div className="detail-field-label">Nº de série</div>
          <div className="detail-field-value mono">{item.serial || '—'}</div>
        </div>
        <div className="detail-field">
          <div className="detail-field-label">Quantidade</div>
          <div className="detail-field-value">{item.qty}</div>
        </div>
        <div className="detail-field">
          <div className="detail-field-label">Localização</div>
          <div className="detail-field-value">{item.location || '—'}</div>
        </div>
      </div>

      {status && status.key !== 'ok' && (
        <div className="card" style={{ background: 'var(--bg-tint)', border: 'none', marginTop: 16 }}>
          <span className={'status-pill ' + status.key}>{status.label}</span>
          <div style={{ fontSize: 12.5, marginTop: 8 }}>Data prevista: {item.maintenance_due}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Última manutenção: {item.last_maintenance || 'sem registro'}</div>
          <button className="btn btn-dark" style={{ marginTop: 12, width: '100%' }} onClick={handleMarkDone} disabled={saving}>
            Marcar manutenção como realizada
          </button>
        </div>
      )}

      {item.description && <div className="detail-desc">{item.description}</div>}

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={() => setEditing(true)}>Editar</button>
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          Anexar imagem
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
        </label>
      </div>

      {editing && (
        <EditModal item={item} onClose={() => setEditing(false)} onSaved={(u) => { setItem(u); setEditing(false) }} />
      )}
    </div>
  )
}

function EditModal({ item, onClose, onSaved }) {
  const [name, setName] = useState(item.name)
  const [brand, setBrand] = useState(item.brand || '')
  const [serial, setSerial] = useState(item.serial || '')
  const [qty, setQty] = useState(item.qty)
  const [location, setLocation] = useState(item.location || '')
  const [description, setDescription] = useState(item.description || '')
  const [maintenanceDue, setMaintenanceDue] = useState(item.maintenance_due || '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateItem(item.id, {
        name, brand, serial, qty: Number(qty) || 0, location, description,
        maintenance_due: maintenanceDue || null,
      })
      onSaved(updated)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-sheet" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
        <div className="modal-title">Editar item</div>
        <label className="field-label">Nome</label>
        <input className="input" style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="field-grid">
          <div><label className="field-label">Marca</label><input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
          <div><label className="field-label">Nº de série</label><input className="input mono" value={serial} onChange={(e) => setSerial(e.target.value)} /></div>
          <div><label className="field-label">Quantidade</label><input className="input" type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label className="field-label">Localização</label><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        </div>
        <label className="field-label">Próxima manutenção</label>
        <input className="input" style={{ marginBottom: 12 }} type="date" value={maintenanceDue} onChange={(e) => setMaintenanceDue(e.target.value)} />
        <label className="field-label">Descrição</label>
        <textarea className="input" style={{ height: 70, paddingTop: 10, marginBottom: 12 }} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
