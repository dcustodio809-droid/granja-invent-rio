import { useEffect, useState } from 'react'
import { createMaterial, listMaterials, listMovements, registerStockUpdate } from '../lib/data'
import { uploadFile } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import PrintReport from '../components/PrintReport'

export default function Stock() {
  const [tab, setTab] = useState('materiais')
  const [materials, setMaterials] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [updateTarget, setUpdateTarget] = useState(null)
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState(new Set())
  const [selectedMovements, setSelectedMovements] = useState(new Set())
  const { user } = useAuth()

  function load() {
    setLoading(true)
    Promise.all([listMaterials(), listMovements()])
      .then(([m, mv]) => { setMaterials(m); setMovements(mv) })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  function toggleSet(setter, id) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllSet(setter, ids) {
    setter((prev) => (prev.size === ids.length ? new Set() : new Set(ids)))
  }

  const materialColumns = [
    { key: 'name', label: 'Material' },
    { key: 'qty', label: 'Quantidade', render: (r) => `${r.qty} ${r.unit}` },
    { key: 'min_qty', label: 'Mínimo', render: (r) => `${r.min_qty} ${r.unit}` },
  ]
  const movementColumns = [
    { key: 'date', label: 'Data', render: (r) => (r.purchase_date ? new Date(r.purchase_date + 'T00:00:00').toLocaleDateString('pt-BR') : new Date(r.created_at).toLocaleDateString('pt-BR')) },
    { key: 'material', label: 'Material', render: (r) => r.material?.name || '—' },
    { key: 'type', label: 'Tipo', render: (r) => (r.type === 'entrada' ? 'Entrada' : 'Saída') },
    { key: 'qty', label: 'Quantidade', render: (r) => `${r.type === 'entrada' ? '+' : '-'}${r.qty} ${r.material?.unit || ''}` },
    { key: 'invoice_number', label: 'Nota fiscal' },
    { key: 'description', label: 'Descrição' },
    { key: 'responsible', label: 'Responsável' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Estoque</div>
          <div className="page-subtitle">Materiais e movimentações</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => window.print()}>Gerar relatório PDF</button>
          {tab === 'materiais' && (
            <button className="btn btn-primary" onClick={() => setShowAddMaterial(true)}>+ Novo material</button>
          )}
        </div>
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
              <tr>
                <th className="select-col">
                  <input
                    type="checkbox"
                    checked={materials.length > 0 && selectedMaterials.size === materials.length}
                    onChange={() => toggleAllSet(setSelectedMaterials, materials.map((m) => m.id))}
                  />
                </th>
                <th>Foto</th><th>Material</th><th>Quantidade</th><th>Mínimo</th><th></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const low = Number(m.qty) <= Number(m.min_qty)
                return (
                  <tr key={m.id}>
                    <td className="select-col">
                      <input type="checkbox" checked={selectedMaterials.has(m.id)} onChange={() => toggleSet(setSelectedMaterials, m.id)} />
                    </td>
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
              {materials.length === 0 && <tr><td colSpan={6} className="empty-hint">Nenhum material cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="select-col">
                  <input
                    type="checkbox"
                    checked={movements.length > 0 && selectedMovements.size === movements.length}
                    onChange={() => toggleAllSet(setSelectedMovements, movements.map((m) => m.id))}
                  />
                </th>
                <th>Data</th><th>Material</th><th>Tipo</th><th>Quantidade</th><th>Nota fiscal</th><th>Descrição</th><th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mv) => (
                <tr key={mv.id}>
                  <td className="select-col">
                    <input type="checkbox" checked={selectedMovements.has(mv.id)} onChange={() => toggleSet(setSelectedMovements, mv.id)} />
                  </td>
                  <td>{mv.purchase_date ? new Date(mv.purchase_date + 'T00:00:00').toLocaleDateString('pt-BR') : new Date(mv.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{mv.material?.name}</td>
                  <td style={{ color: mv.type === 'entrada' ? '#141414' : 'var(--red)', fontWeight: 700 }}>
                    {mv.type === 'entrada' ? 'Entrada' : 'Saída'}
                  </td>
                  <td style={{ color: mv.type === 'entrada' ? '#141414' : 'var(--red)', fontWeight: 700 }}>
                    {mv.type === 'entrada' ? '+' : '-'}{mv.qty} {mv.material?.unit}
                  </td>
                  <td>{mv.invoice_number || '—'}</td>
                  <td>{mv.description || '—'}</td>
                  <td>{mv.responsible || '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={8} className="empty-hint">Nenhuma movimentação registrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <PrintReport
        title={tab === 'materiais' ? 'Relatório de Materiais' : 'Relatório de Movimentação de Estoque'}
        columns={tab === 'materiais' ? materialColumns : movementColumns}
        rows={
          tab === 'materiais'
            ? (selectedMaterials.size > 0 ? materials.filter((m) => selectedMaterials.has(m.id)) : materials)
            : (selectedMovements.size > 0 ? movements.filter((m) => selectedMovements.has(m.id)) : movements)
        }
      />

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
  const [type, setType] = useState('entrada')
  const [amount, setAmount] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [movementDate, setMovementDate] = useState('')
  const [description, setDescription] = useState('')
  const [responsible, setResponsible] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setError('')
    const qty = Number(amount)
    if (!qty || qty <= 0) {
      setError('Informe uma quantidade válida.')
      return
    }
    setSaving(true)
    try {
      await registerStockUpdate({
        material,
        type,
        amount: qty,
        invoiceNumber: type === 'entrada' ? invoiceNumber : null,
        purchaseDate: movementDate || null,
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
        <div className="modal-sub">{material.name} · {material.qty} {material.unit} em estoque</div>

        <div className="segmented" style={{ width: '100%', marginBottom: 16 }}>
          <button
            type="button"
            className={'segmented-item' + (type === 'entrada' ? ' active' : '')}
            style={{ flex: 1 }}
            onClick={() => setType('entrada')}
          >
            Entrada
          </button>
          <button
            type="button"
            className={'segmented-item' + (type === 'saida' ? ' active' : '')}
            style={{ flex: 1 }}
            onClick={() => setType('saida')}
          >
            Saída
          </button>
        </div>

        {type === 'entrada' ? (
          <div className="field-grid">
            <div>
              <label className="field-label">Número da nota fiscal</label>
              <input className="input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ex: 12345" />
            </div>
            <div>
              <label className="field-label">Data da compra</label>
              <input className="input" type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Data de saída</label>
            <input className="input" type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
          </div>
        )}

        <label className="field-label">Descrição</label>
        <textarea
          className="input"
          style={{ height: 60, paddingTop: 10, marginBottom: 12 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === 'entrada' ? 'Informações sobre esta entrada' : 'Informações sobre esta saída'}
        />

        <label className="field-label">Responsável</label>
        <input className="input" style={{ marginBottom: 12 }} value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Seu nome" />

        <label className="field-label">{type === 'entrada' ? 'Quantidade comprada' : 'Quantidade retirada'}</label>
        <input
          className="input"
          type="number"
          min="0"
          style={{ marginBottom: 4 }}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Quantidade em ${material.unit}`}
        />
        <div className="empty-hint" style={{ padding: '4px 2px 12px' }}>
          Estoque {type === 'entrada' ? 'após somar' : 'após subtrair'}: {
            amount
              ? (type === 'entrada' ? Number(material.qty) + Number(amount) : Math.max(0, Number(material.qty) - Number(amount)))
              : material.qty
          } {material.unit}
        </div>

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
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let photo_url = null
      if (photo) photo_url = await uploadFile(photo, 'materials')
      await createMaterial({ name, unit, qty: Number(qty), min_qty: Number(minQty), photo_url, created_by: userId })
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

        <label className={'dropzone' + (photo ? ' attached' : '')}>
          {photo ? `Foto selecionada: ${photo.name}` : 'ANEXAR FOTO DO MATERIAL'}
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
