import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CATEGORIES, categoryLabel, getItem, updateItem, addItemPhoto, removeItemPhoto } from '../lib/data'
import { uploadFile } from '../lib/supabaseClient'
import ImageCropper from '../components/ImageCropper'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  function load() {
    setLoading(true)
    getItem(id).then(setItem).finally(() => setLoading(false))
  }
  useEffect(load, [id])

  if (loading || !item) return <div className="empty-hint">Carregando...</div>

  const isVehicle = item.category === 'veiculo'
  const photos = item.photos && item.photos.length > 0 ? item.photos : (item.photo_url ? [item.photo_url] : [])
  const activePhoto = photos[Math.min(activeIndex, photos.length - 1)]

  return (
    <div style={{ maxWidth: 640 }}>
      <button className="back-link" onClick={() => navigate(-1)}>&larr; Voltar</button>

      <div className="detail-photo">
        {activePhoto ? (
          <img src={activePhoto} alt="" className="detail-photo-img" />
        ) : (
          'SEM FOTO'
        )}
      </div>

      {photos.length > 1 && (
        <div className="photo-thumb-strip">
          {photos.map((url, i) => (
            <button
              type="button"
              key={url}
              className={'photo-thumb-small' + (i === activeIndex ? ' active' : '')}
              onClick={() => setActiveIndex(i)}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      )}

      <span className="pill pill-tint">{categoryLabel(item.category)}</span>
      <div className="detail-name">{item.name}</div>

      <div className="field-grid">
        <div className="detail-field">
          <div className="detail-field-label">Marca</div>
          <div className="detail-field-value">{item.brand || '—'}</div>
        </div>

        {isVehicle ? (
          <>
            <div className="detail-field">
              <div className="detail-field-label">Placa</div>
              <div className="detail-field-value mono">{item.plate || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Renavam</div>
              <div className="detail-field-value mono">{item.renavam || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Chassi</div>
              <div className="detail-field-value mono">{item.chassi || '—'}</div>
            </div>
          </>
        ) : (
          <div className="detail-field">
            <div className="detail-field-label">Nº de série</div>
            <div className="detail-field-value mono">{item.serial || '—'}</div>
          </div>
        )}

        <div className="detail-field">
          <div className="detail-field-label">Quantidade</div>
          <div className="detail-field-value">{item.qty}</div>
        </div>
        <div className="detail-field">
          <div className="detail-field-label">Localização</div>
          <div className="detail-field-value">{item.location || '—'}</div>
        </div>
      </div>

      {item.description && <div className="detail-desc">{item.description}</div>}

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setEditing(true)}>Editar</button>
      </div>

      {editing && (
        <EditModal
          item={item}
          onClose={() => setEditing(false)}
          onSaved={(u) => { setItem(u); setEditing(false) }}
          onPhotosChanged={(u) => setItem(u)}
        />
      )}
    </div>
  )
}

function EditModal({ item, onClose, onSaved, onPhotosChanged }) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [brand, setBrand] = useState(item.brand || '')
  const [serial, setSerial] = useState(item.serial || '')
  const [plate, setPlate] = useState(item.plate || '')
  const [renavam, setRenavam] = useState(item.renavam || '')
  const [chassi, setChassi] = useState(item.chassi || '')
  const [qty, setQty] = useState(item.qty)
  const [location, setLocation] = useState(item.location || '')
  const [description, setDescription] = useState(item.description || '')
  const [saving, setSaving] = useState(false)
  const [currentItem, setCurrentItem] = useState(item)
  const [cropSrc, setCropSrc] = useState(null)
  const [photoSaving, setPhotoSaving] = useState(false)
  const isVehicle = category === 'veiculo'
  const photos = currentItem.photos && currentItem.photos.length > 0
    ? currentItem.photos
    : (currentItem.photo_url ? [currentItem.photo_url] : [])

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCropSrc({ url: URL.createObjectURL(file), name: file.name })
  }

  async function handleCroppedPhoto(file) {
    setCropSrc(null)
    setPhotoSaving(true)
    try {
      const photo_url = await uploadFile(file, 'items')
      const updated = await addItemPhoto(currentItem, photo_url)
      setCurrentItem(updated)
      onPhotosChanged(updated)
    } finally {
      setPhotoSaving(false)
    }
  }

  async function handleRemovePhoto(url) {
    setPhotoSaving(true)
    try {
      const updated = await removeItemPhoto(currentItem, url)
      setCurrentItem(updated)
      onPhotosChanged(updated)
    } finally {
      setPhotoSaving(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateItem(item.id, {
        name, category, brand,
        serial: isVehicle ? '' : serial,
        plate: isVehicle ? plate : null,
        renavam: isVehicle ? renavam : null,
        chassi: isVehicle ? chassi : null,
        qty: Number(qty) || 0, location, description,
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

        <label className="field-label">Fotos</label>
        <div className="photo-grid">
          {photos.map((url) => (
            <div key={url} className="photo-thumb">
              <img src={url} alt="" />
              <button
                type="button"
                className="photo-thumb-remove"
                onClick={() => handleRemovePhoto(url)}
                disabled={photoSaving}
                title="Remover foto"
              >
                ×
              </button>
            </div>
          ))}
          <label className="photo-thumb photo-thumb-add">
            {photoSaving ? '...' : '+'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} disabled={photoSaving} />
          </label>
        </div>

        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc.url}
            fileName={cropSrc.name}
            onCancel={() => setCropSrc(null)}
            onConfirm={handleCroppedPhoto}
          />
        )}

        <label className="field-label">Nome</label>
        <input className="input" style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} required />

        <label className="field-label">Categoria</label>
        <select className="input" style={{ marginBottom: 12 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <div className="field-grid">
          <div><label className="field-label">Marca</label><input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></div>

          {isVehicle ? (
            <>
              <div><label className="field-label">Placa</label><input className="input mono" value={plate} onChange={(e) => setPlate(e.target.value)} /></div>
              <div><label className="field-label">Renavam</label><input className="input mono" value={renavam} onChange={(e) => setRenavam(e.target.value)} /></div>
              <div><label className="field-label">Chassi</label><input className="input mono" value={chassi} onChange={(e) => setChassi(e.target.value)} /></div>
            </>
          ) : (
            <div><label className="field-label">Nº de série</label><input className="input mono" value={serial} onChange={(e) => setSerial(e.target.value)} /></div>
          )}

          <div><label className="field-label">Quantidade</label><input className="input" type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label className="field-label">Localização</label><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        </div>

        <label className="field-label">Descrição</label>
        <textarea className="input" style={{ height: 70, paddingTop: 10, marginBottom: 12 }} value={description} onChange={(e) => setDescription(e.target.value)} />

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
