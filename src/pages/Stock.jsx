import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { createMaterial, deleteMaterials, deleteMovements, listMaterials, listMovements, registerStockUpdate } from '../lib/data'
import { uploadFile } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import PrintReport from '../components/PrintReport'
import ImageCropper from '../components/ImageCropper'
import MaterialLabels, { Label, LABELS_PER_SHEET } from '../components/MaterialLabels'

// Para onde o Almoxarifado entrega o material numa saída
const DESTINATIONS = ['Escritório', 'Gerência', 'Núcleo 1', 'Núcleo 2', 'Núcleo 3']

function formatBRL(value) {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Stock() {
  const [tab, setTab] = useState('materiais')
  const [materials, setMaterials] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [updateTarget, setUpdateTarget] = useState(null)
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState(new Set())
  const [selectedMovements, setSelectedMovements] = useState(new Set())
  const [labelTargets, setLabelTargets] = useState(null)
  const { user } = useAuth()

  function openLabels() {
    const list = selectedMaterials.size > 0 ? materials.filter((m) => selectedMaterials.has(m.id)) : materials
    if (list.length > 0) setLabelTargets(list)
  }

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

  async function handleDeleteMaterials() {
    if (selectedMaterials.size === 0) return
    if (!window.confirm(`Excluir ${selectedMaterials.size} material(is) selecionado(s)? As movimentações ligadas a eles também serão excluídas. Essa ação não pode ser desfeita.`)) return
    await deleteMaterials([...selectedMaterials])
    setSelectedMaterials(new Set())
    load()
  }

  async function handleDeleteMovements() {
    if (selectedMovements.size === 0) return
    if (!window.confirm(`Excluir ${selectedMovements.size} movimentação(ões) selecionada(s)? Essa ação não altera o saldo do estoque, só remove o registro. Essa ação não pode ser desfeita.`)) return
    await deleteMovements([...selectedMovements])
    setSelectedMovements(new Set())
    load()
  }

  const materialColumns = [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Material' },
    { key: 'qty', label: 'Quantidade', render: (r) => `${r.qty} ${r.unit}` },
    { key: 'min_qty', label: 'Mínimo', render: (r) => `${r.min_qty} ${r.unit}` },
    { key: 'unit_price', label: 'Valor unitário', render: (r) => formatBRL(r.unit_price) },
    { key: 'total_value', label: 'Valor em estoque', render: (r) => formatBRL(Number(r.qty) * Number(r.unit_price || 0)) },
  ]
  const movementColumns = [
    { key: 'date', label: 'Data', render: (r) => (r.purchase_date ? new Date(r.purchase_date + 'T00:00:00').toLocaleDateString('pt-BR') : new Date(r.created_at).toLocaleDateString('pt-BR')) },
    { key: 'material', label: 'Material', render: (r) => r.material?.name || '—' },
    { key: 'type', label: 'Tipo', render: (r) => (r.type === 'entrada' ? 'Entrada' : 'Saída') },
    { key: 'destination', label: 'Destino', render: (r) => (r.type === 'saida' ? r.destination || '—' : '—') },
    { key: 'qty', label: 'Quantidade', render: (r) => `${r.type === 'entrada' ? '+' : '-'}${r.qty} ${r.material?.unit || ''}` },
    { key: 'unit_price', label: 'Valor unitário', render: (r) => formatBRL(r.unit_price) },
    { key: 'total_value', label: 'Valor total', render: (r) => formatBRL(r.total_value) },
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
          {tab === 'materiais' && selectedMaterials.size > 0 && (
            <button className="btn" style={{ background: 'var(--bg-tint)', color: 'var(--red)' }} onClick={handleDeleteMaterials}>
              Excluir selecionados ({selectedMaterials.size})
            </button>
          )}
          {tab === 'movimentacao' && selectedMovements.size > 0 && (
            <button className="btn" style={{ background: 'var(--bg-tint)', color: 'var(--red)' }} onClick={handleDeleteMovements}>
              Excluir selecionados ({selectedMovements.size})
            </button>
          )}
          {tab === 'materiais' && (
            <button className="btn btn-secondary" onClick={openLabels}>
              Imprimir etiquetas{selectedMaterials.size > 0 ? ` (${selectedMaterials.size})` : ''}
            </button>
          )}
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
                <th>Foto</th><th>Código</th><th>Material</th><th>Quantidade</th><th>Mínimo</th><th>Valor unitário</th><th>Valor em estoque</th><th></th>
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
                    <td style={{ fontFamily: 'ui-monospace, Consolas, monospace', whiteSpace: 'nowrap' }}>{m.code || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{m.name}</td>
                    <td style={{ color: low ? 'var(--red)' : undefined, fontWeight: low ? 700 : 400 }}>
                      {m.qty} {m.unit}{low ? ' (abaixo do mínimo)' : ''}
                    </td>
                    <td>{m.min_qty} {m.unit}</td>
                    <td>{formatBRL(m.unit_price)}</td>
                    <td style={{ fontWeight: 700 }}>{formatBRL(Number(m.qty) * Number(m.unit_price || 0))}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" style={{ height: 34, padding: '0 12px' }} onClick={() => setLabelTargets([m])}>Etiqueta</button>
                        <button className="btn btn-primary" style={{ height: 34, padding: '0 12px' }} onClick={() => setUpdateTarget(m)}>Atualizar</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {materials.length === 0 && <tr><td colSpan={9} className="empty-hint">Nenhum material cadastrado.</td></tr>}
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
                <th>Data</th><th>Material</th><th>Tipo</th><th>Destino</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th><th>Nota fiscal</th><th>Descrição</th><th>Responsável</th>
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
                  <td>{mv.type === 'saida' ? mv.destination || '—' : '—'}</td>
                  <td style={{ color: mv.type === 'entrada' ? '#141414' : 'var(--red)', fontWeight: 700 }}>
                    {mv.type === 'entrada' ? '+' : '-'}{mv.qty} {mv.material?.unit}
                  </td>
                  <td>{formatBRL(mv.unit_price)}</td>
                  <td style={{ fontWeight: 700 }}>{formatBRL(mv.total_value)}</td>
                  <td>{mv.invoice_number || '—'}</td>
                  <td>{mv.description || '—'}</td>
                  <td>{mv.responsible || '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={11} className="empty-hint">Nenhuma movimentação registrada.</td></tr>}
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

      {labelTargets && (
        <LabelPrintModal materials={labelTargets} onClose={() => setLabelTargets(null)} />
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
  const [unitPrice, setUnitPrice] = useState(material.unit_price || '')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [movementDate, setMovementDate] = useState('')
  const [description, setDescription] = useState('')
  const [responsible, setResponsible] = useState('')
  const [destination, setDestination] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const totalValue = amount && unitPrice ? Number(amount) * Number(unitPrice) : 0

  async function handleConfirm() {
    setError('')
    const qty = Number(amount)
    if (!qty || qty <= 0) {
      setError('Informe uma quantidade válida.')
      return
    }
    if (type === 'saida' && !destination) {
      setError('Escolha para onde o material foi.')
      return
    }
    setSaving(true)
    try {
      await registerStockUpdate({
        material,
        type,
        amount: qty,
        unitPrice: unitPrice !== '' ? unitPrice : null,
        invoiceNumber: type === 'entrada' ? invoiceNumber : null,
        purchaseDate: movementDate || null,
        destination: type === 'saida' ? destination : null,
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
          <div className="field-grid">
            <div>
              <label className="field-label">Destino (para onde foi)</label>
              <select className="input" value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="">Escolha...</option>
                {DESTINATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Data de saída</label>
              <input className="input" type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
            </div>
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

        <div className="field-grid">
          <div>
            <label className="field-label">{type === 'entrada' ? 'Quantidade comprada' : 'Quantidade retirada'}</label>
            <input
              className="input"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Quantidade em ${material.unit}`}
            />
          </div>
          <div>
            <label className="field-label">Valor unitário</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="R$ 0,00"
            />
          </div>
        </div>
        <div className="empty-hint" style={{ padding: '4px 2px 12px' }}>
          Estoque {type === 'entrada' ? 'após somar' : 'após subtrair'}: {
            amount
              ? (type === 'entrada' ? Number(material.qty) + Number(amount) : Math.max(0, Number(material.qty) - Number(amount)))
              : material.qty
          } {material.unit}
          {totalValue > 0 && ` · Valor total: ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
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

function LabelPrintModal({ materials, onClose }) {
  const [copies, setCopies] = useState(() => Object.fromEntries(materials.map((m) => [m.id, 1])))
  const [startAt, setStartAt] = useState(1)
  const [printing, setPrinting] = useState(false)
  const missingCode = materials.some((m) => !m.code)

  const labels = materials.flatMap((m) => Array(Math.max(0, Number(copies[m.id]) || 0)).fill(m))
  const sheets = labels.length > 0 ? Math.ceil((labels.length + startAt - 1) / LABELS_PER_SHEET) : 0

  function handlePrint() {
    if (labels.length === 0) return
    flushSync(() => setPrinting(true))
    document.body.classList.add('printing-labels')
    const cleanup = () => {
      document.body.classList.remove('printing-labels')
      setPrinting(false)
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    // dá tempo para o navegador desenhar os códigos de barras antes de abrir a impressão
    setTimeout(() => window.print(), 150)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Imprimir etiquetas</div>
        <div className="modal-sub">Folha A4 adesiva com 21 etiquetas (3 × 7, 63,5 × 38,1 mm — tipo Pimaco A4360)</div>

        <div className="label-preview"><Label material={materials[0]} /></div>

        {missingCode && (
          <div className="login-error">
            Há material sem código. Rode a atualização 6 do banco (migration_6.sql) no Supabase antes de imprimir.
          </div>
        )}

        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
          {materials.map((m) => (
            <div className="label-copies-row" key={m.id}>
              <div className="label-copies-name">
                {m.name}
                <div className="label-copies-code">{m.code || 'sem código'}</div>
              </div>
              <input
                className="input"
                type="number"
                min="0"
                max="210"
                value={copies[m.id]}
                onChange={(e) => setCopies((prev) => ({ ...prev, [m.id]: e.target.value }))}
                aria-label={`Cópias de ${m.name}`}
              />
            </div>
          ))}
        </div>

        <label className="field-label">Começar na posição da folha (1 a 21)</label>
        <input
          className="input"
          type="number"
          min="1"
          max={LABELS_PER_SHEET}
          value={startAt}
          onChange={(e) => setStartAt(Math.min(LABELS_PER_SHEET, Math.max(1, Number(e.target.value) || 1)))}
        />
        <div className="empty-hint" style={{ padding: '6px 2px 12px' }}>
          Use se a folha já teve etiquetas usadas. A posição 1 é a do canto superior esquerdo; conta da esquerda para a direita.
          <br />
          {labels.length} etiqueta(s) · {sheets} folha(s)
        </div>

        <div className="empty-hint" style={{ padding: '0 2px 12px' }}>
          Na janela de impressão, escolha papel A4, margens "Nenhuma" e escala 100%.
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" onClick={handlePrint} disabled={labels.length === 0 || missingCode}>Imprimir</button>
        </div>
      </div>
      {printing && <MaterialLabels labels={labels} startAt={startAt} />}
    </div>
  )
}

function AddMaterialModal({ userId, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [qty, setQty] = useState(0)
  const [minQty, setMinQty] = useState(0)
  const [unitPrice, setUnitPrice] = useState('')
  const [photo, setPhoto] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      if (photo) photo_url = await uploadFile(photo, 'materials')
      await createMaterial({ name, unit, qty: Number(qty), min_qty: Number(minQty), unit_price: unitPrice !== '' ? Number(unitPrice) : 0, photo_url, created_by: userId })
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
              <option value="L">litros (L)</option>
              <option value="lata">latas</option>
              <option value="sc">saco</option>
              <option value="cx">caixas</option>
            </select>
          </div>
          <div><label className="field-label">Qtd. inicial</label><input className="input" type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label className="field-label">Estoque mínimo</label><input className="input" type="number" value={minQty} onChange={(e) => setMinQty(e.target.value)} /></div>
          <div><label className="field-label">Valor unitário</label><input className="input" type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="R$ 0,00" /></div>
        </div>

        <label className={'dropzone' + (photo ? ' attached' : '')}>
          {photo ? `Foto selecionada: ${photo.name}` : 'ANEXAR FOTO DO MATERIAL'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
        </label>

        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc.url}
            fileName={cropSrc.name}
            aspect={1}
            onCancel={() => setCropSrc(null)}
            onConfirm={(file) => { setPhoto(file); setCropSrc(null) }}
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
