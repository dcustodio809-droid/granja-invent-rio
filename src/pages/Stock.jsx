import { useEffect, useState } from 'react'
import { createMaterial, listMaterials, listMovements, registerStockUpdate } from '../lib/data'
import { supabase, uploadFile } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Stock() {
  const [tab, setTab] = useState('materiais')
  const [materials, setMaterials] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [updateTarget, setUpdateTarget] = useState(null)
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const { user } = useAuth()

  function load() {
    setLoading(true)
    Promise.all([listMaterials(), listMovements()])
      .then(([m, mv]) => { setMaterials(m); setMovements(mv) })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Estoque</div>
          <div className="page-subtitle">Materiais e movimentações</div>
        </div>
        {tab === 'materiais' && (
          <button className="btn btn-primary" onClick={() => setShowAddMaterial(true)}>+ Novo material</button>
        )}
      </div>

      <div className="segmented">
        <button className={'segmented-item' + (tab === 'materiais' ? ' active' : '')} onClick={() => setTab('materiais')}>Materiais</button>
        <button className={'segmented-item' + (tab === 'movimentacao' ? ' active' : '')} onClick={() => setTab('movimentacao')}>Movimentação</button>
      </div>

      {loading ? (
        <div className="empty-hint">Carregando...</div>
      ) : tab === 'materiais' ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Foto</th><th>Material</th><th>Quantidade</th><th>Mínimo</th><th></th></tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const low = Number(m.qty) <= Number(m.min_qty)
                return (
                  <tr key={m.id}>
                    <td>{m.photo_url ? <img className="table-photo" src={m.photo_url} alt="" /> : <div className="table-photo" />}</td>
                    <td style={{ fontWeight: 700 }}>{m.name}</td>
                    <td style={{ color: low ? 'var(--red)' : undefined, fontWeight: low ? 700 : 400 }}>
                      {m.qty} {m.unit}{low ? ' (abaixo do mínimo)' : ''}
                    </td>
                    <td>{m.min_qty} {m.unit}</td>
                    <td><button className="btn btn-primary" style={{ height: 34, padding: '0 12px' }} onClick={() => setUpdateTarget(m)}>Atualizar</button></td>
                  </tr>
                )
              })}
              {materials.length === 0 && <tr><td colSpan={5} className="empty-hint">Nenhum material cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Data</th><th>Material</th><th>Tipo</th><th>Quantidade</th><th>Nota fiscal</th><th>Descrição</th><th>Responsável</th></tr>
            </thead>
            <tbody>
              {movements.map((mv) => (
                <tr key={mv.id}>
                  <td>{new Date(mv.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{mv.material?.name}</td>
                  <td style={{ color: mv.type === 'entrada' ? '#141414' : 'var(--red)', fontWeight: 700 }}>
                    {mv.type === 'entrada' ? 'Entrada' : 'Saída'}
                  </td>
                  <td style={{ color: mv.type === 'entrada' ? '#141414' : 'var(--red)', fontWeight: 700 }}>
                    {mv.type === 'entrada' ? '+' : '-'}{mv.qty} {mv.material?.unit}
                  </td>
                  <td>{mv.invoice_number ? `${mv.invoice_number}${mv.purchase_date ? ' · ' + new Date(mv.purchase_date + 'T00:00:00').toLocaleDateString('pt-BR') : ''}` : '—'}</td>
                  <td>{mv.description || '—'}</td>
                  <td>{mv.responsible || '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={7} className="empty-hint">Nenhuma movimentação registrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {updateTarget && (
        <StockUpdateModal
          material={updateTarget}
          userId={user?.id}
          onClose={() => setUpdateTarget(null)}
          onDone={() => { setUpdateTarget(null); load() }}
        />
      )}

      {showAddMaterial && (
        <AddMaterialModal
          userId={user?.id}
          onClose={() => setShowAddMaterial(false)}
          onCreated={() => { setShowAddMaterial(false); load() }}
        />
      )}
    </div>
  )
}

function StockUpdateModal({ material, userId, onClose, onDone }) {
  const [qty, setQty] = useState(Number(material.qty))
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [responsible, setResponsible] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const step = material.unit === 'kg' ? 50 : 1

  async function handleConfirm() {
    setSaving(true)
    setError('')
    try {
      if (photo) {
        const photoUrl = await uploadFile(photo, 'materials')
        await supabase.from('materials').update({ photo_url: photoUrl }).eq('id', material.id)
      }
      await registerStockUpdate({
        material,
        newQty: Number(qty),
        invoiceNumber,
        purchaseDate: purchaseDate || null,
        description,
        responsible,
        userId,
      })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Atualizar estoque</div>
        <div className="modal-sub">{material.name}</div>

        <div className="field-grid">
          <div>
            <label className="field-label">Número da nota fiscal</label>
            <input className="input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ex: 12345" />
          </div>
          <div>
            <label className="field-label">Data da compra</label>
            <input className="input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
        </div>

        <label className="field-label">Descrição</label>
        <textarea
          className="input"
          style={{ height: 60, paddingTop: 10, marginBottom: 12 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Informações sobre esta entrada ou saída"
        />

        <label className={'dropzone' + (photo ? ' attached' : '')}>
          {photo ? `Foto do material: ${photo.name}` : 'ANEXAR FOTO DO MATERIAL'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
        </label>

        <label className="field-label">Responsável</label>
        <input className="input" style={{ marginBottom: 12 }} value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Seu nome" />

        <div className="stepper">
          <button type="button" className="stepper-btn" onClick={() => setQty((q) => Math.max(0, q - step))}>−</button>
          <div className="stepper-value">{qty} {material.unit}</div>
          <button type="button" className="stepper-btn" onClick={() => setQty((q) => q + step)}>+</button>
        </div>
        <input className="input" type="number" style={{ marginBottom: 12 }} value={qty} onChange={(e) => setQty(Number(e.target.value))} />

        {error && <div className="login-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>{saving ? 'Salvando...' : 'Confirmar'}</button>
        </div>
      </div>
    </div>
  )
}

function AddMaterialModal({ userId, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [qty, setQty] = useState(0)
  const [minQty, setMinQty] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createMaterial({ name, unit, qty: Number(qty), min_qty: Number(minQty), created_by: userId })
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
        <div className="modal-title">Novo material</div>
        <label className="field-label">Nome</label>
        <input className="input" style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="field-grid">
          <div>
            <label className="field-label">Unidade</label>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="kg">kg</option>
              <option value="un">un</option>
              <option value="L">L</option>
              <option value="sc">saco</option>
            </select>
          </div>
          <div><label className="field-label">Qtd. inicial</label><input className="input" type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label className="field-label">Estoque mínimo</label><input className="input" type="number" value={minQty} onChange={(e) => setMinQty(e.target.value)} /></div>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
