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
  const [error, setError] = useState('')

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
    setError('')
    try {
      const updated = await markMaintenanceDone(item)
      setItem(updated)
    } catch (err) {
      setError(err.message || 'Não foi possível marcar a manutenção como realizada.')
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
          <img src={item.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14 }} />
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
