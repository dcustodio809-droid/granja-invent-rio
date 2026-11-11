import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { createMaterial, deleteMaterials, deleteMovements, listMaterials, listMovements, registerStockUpdate, updateMaterial } from '../lib/data'
import { uploadFile } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import PrintReport from '../components/PrintReport'
import ImageCropper from '../components/ImageCropper'
import MaterialLabels, { Label, LABELS_PER_SHEET } from '../components/MaterialLabels'
import InvoiceImportModal from '../components/InvoiceImportModal'
import { UNITS } from '../lib/nfe'

// Para onde o Almoxarifado entrega o material numa saída
const DESTINATIONS = ['Escritório', 'Gerência', 'Núcleo 1', 'Núcleo 2', 'Núcleo 3']
// Toda entrada (nota fiscal ou manual) chega no Almoxarifado
const ENTRY_DESTINATION = 'Almoxarifado'
const ALL_LOCATIONS = [ENTRY_DESTINATION, ...DESTINATIONS]

// Local da movimentação: entrada é sempre no Almoxarifado; saída é o destino escolhido
function movementPlace(mv) {
  return mv.type === 'entrada' ? ENTRY_DESTINATION : mv.destination
}

function formatBRL(value) {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// 'AAAA-MM-DD' no horário local
function isoDate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Data da movimentação: a informada (compra/saída) ou, se não houver, o dia do lançamento
function movementDay(mv) {
  return mv.purchase_date || isoDate(new Date(mv.created_at))
}

function formatDay(iso) {
  return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : ''
}

// Colunas da tabela de materiais que ordenam ao clicar no título (igual ao Inventário)
const MATERIAL_SORT_COLUMNS = [
  { key: 'photo', label: 'Foto' },
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Material' },
  { key: 'qty', label: 'Quantidade' },
  { key: 'min_qty', label: 'Mínimo' },
  { key: 'unit_price', label: 'Valor unitário' },
  { key: 'total_value', label: 'Valor em estoque' },
]

const EMPTY_MV_FILTERS = { from: '', to: '', type: 'todos', destination: 'todos', materialId: 'todos', search: '' }

function quickPeriod(key) {
  const now = new Date()
  if (key === 'hoje') return { from: isoDate(now), to: isoDate(now) }
  if (key === '7dias') return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: isoDate(now) }
  if (key === 'mes') return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
  if (key === 'mespassado') return { from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)) }
  return { from: '', to: '' }
}

export default function Stock() {
  const [tab, setTab] = useState('materiais')
  const [materials, setMaterials] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [materialTarget, setMaterialTarget] = useState(null) // { material, tab: 'movimentar' | 'editar' }
  const [matSort, setMatSort] = useState({ key: 'name', dir: 'asc' })
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState(new Set())
  const [selectedMovements, setSelectedMovements] = useState(new Set())
  const [labelTargets, setLabelTargets] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [notice, setNotice] = useState('')

  function handleMatSort(key) {
    setMatSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const sortedMaterials = useMemo(() => {
    const value = (m) => {
      switch (matSort.key) {
        case 'photo': return m.photo_url ? 0 : 1 // com foto primeiro
        case 'qty': return Number(m.qty) || 0
        case 'min_qty': return Number(m.min_qty) || 0
        case 'unit_price': return Number(m.unit_price) || 0
        case 'total_value': return (Number(m.qty) || 0) * (Number(m.unit_price) || 0)
        default: return String(m[matSort.key] || '').toLowerCase()
      }
    }
    return [...materials].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      const cmp = typeof va === 'number' ? va - vb : va.localeCompare(vb, 'pt-BR', { numeric: true })
      return (matSort.dir === 'asc' ? cmp : -cmp) || String(a.name).localeCompare(String(b.name), 'pt-BR')
    })
  }, [materials, matSort])
  const [mvFilters, setMvFilters] = useState(EMPTY_MV_FILTERS)
  const [showMvFilters, setShowMvFilters] = useState(false)
  const { user } = useAuth()

  const mvFilterActive =
    mvFilters.from || mvFilters.to || mvFilters.type !== 'todos' || mvFilters.destination !== 'todos' || mvFilters.materialId !== 'todos'

  const filteredMovements = useMemo(() => {
    const q = mvFilters.search.trim().toLowerCase()
    return movements.filter((mv) => {
      const day = movementDay(mv)
      if (mvFilters.from && day < mvFilters.from) return false
      if (mvFilters.to && day > mvFilters.to) return false
      if (mvFilters.type !== 'todos' && mv.type !== mvFilters.type) return false
      if (mvFilters.destination !== 'todos' && movementPlace(mv) !== mvFilters.destination) return false
      if (mvFilters.materialId !== 'todos' && mv.material_id !== mvFilters.materialId) return false
      if (q) {
        const hay = [mv.invoice_number, mv.description, mv.responsible, mv.material?.name, mv.material?.code].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      // mais recente primeiro, pela data da movimentação; empate pelo horário do lançamento
      const d = movementDay(b).localeCompare(movementDay(a))
      return d !== 0 ? d : String(b.created_at).localeCompare(String(a.created_at))
    })
  }, [movements, mvFilters])

  // Resumo do filtro (quantidade somada quando o filtro é de um material só)
  const mvSummary = useMemo(() => {
    let text = `${filteredMovements.length} movimentação(ões)`
    if (mvFilters.materialId !== 'todos' && filteredMovements.length > 0) {
      const unit = filteredMovements[0].material?.unit || ''
      const inQty = filteredMovements.filter((m) => m.type === 'entrada').reduce((s, m) => s + Number(m.qty), 0)
      const outQty = filteredMovements.filter((m) => m.type === 'saida').reduce((s, m) => s + Number(m.qty), 0)
      text += ` · Entradas: ${inQty.toLocaleString('pt-BR')} ${unit} · Saídas: ${outQty.toLocaleString('pt-BR')} ${unit}`
    }
    const value = filteredMovements.filter((m) => m.type === 'entrada').reduce((s, m) => s + Number(m.total_value || 0), 0)
    if (value > 0) text += ` · Valor das entradas: ${formatBRL(value)}`
    return text
  }, [filteredMovements, mvFilters.materialId])

  // Descrição dos filtros para o título do relatório PDF
  const mvFilterLabel = useMemo(() => {
    const parts = []
    if (mvFilters.from || mvFilters.to) parts.push(`${formatDay(mvFilters.from) || 'início'} a ${formatDay(mvFilters.to) || 'hoje'}`)
    if (mvFilters.type !== 'todos') parts.push(mvFilters.type === 'entrada' ? 'Entradas' : 'Saídas')
    if (mvFilters.destination !== 'todos') parts.push(`Destino: ${mvFilters.destination}`)
    if (mvFilters.materialId !== 'todos') parts.push(`Material: ${materials.find((m) => m.id === mvFilters.materialId)?.name || ''}`)
    if (mvFilters.search.trim()) parts.push(`Busca: "${mvFilters.search.trim()}"`)
    return parts.join(' · ')
  }, [mvFilters, materials])

  function setMvFilter(patch) {
    setMvFilters((prev) => ({ ...prev, ...patch }))
    setSelectedMovements(new Set())
  }

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
    { key: 'material', label: 'Material', render: (r) => (r.material ? `${r.material.code ? r.material.code + ' · ' : ''}${r.material.name}` : '—') },
    { key: 'type', label: 'Tipo', render: (r) => (r.type === 'entrada' ? 'Entrada' : 'Saída') },
    { key: 'destination', label: 'Destino', render: (r) => movementPlace(r) || '—' },
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
          <button className="btn btn-secondary" onClick={() => { setNotice(''); setShowImport(true) }}>Importar nota fiscal</button>
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

      {notice && (
        <div className="alert-row" style={{ marginBottom: 12 }} onClick={() => setNotice('')}>
          <span className="alert-dot" />
          <div style={{ fontWeight: 700 }}>{notice}</div>
        </div>
      )}

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
                {MATERIAL_SORT_COLUMNS.map((col) => (
                  <th key={col.key} className="sortable-th" onClick={() => handleMatSort(col.key)} title="Clique para ordenar">
                    {col.label}{matSort.key === col.key ? (matSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedMaterials.map((m) => {
                const low = Number(m.qty) <= Number(m.min_qty)
                return (
                  <tr key={m.id}>
                    <td className="select-col">
                      <input type="checkbox" checked={selectedMaterials.has(m.id)} onChange={() => toggleSet(setSelectedMaterials, m.id)} />
                    </td>
                    <td>
                      <button type="button" className="photo-cell-btn" onClick={() => setMaterialTarget({ material: m, tab: 'editar' })} title={m.photo_url ? 'Editar material / trocar foto' : 'Adicionar foto'}>
                        {m.photo_url ? <img className="table-photo" src={m.photo_url} alt="" /> : <div className="table-photo table-photo-add">+ foto</div>}
                      </button>
                    </td>
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
                        <button type="button" className="icon-btn primary" title="Entrada / saída e editar dados" aria-label={`Atualizar ou editar ${m.name}`}
                          onClick={() => setMaterialTarget({ material: m, tab: 'movimentar' })}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4" /><path d="M13.5 6.5l4 4" />
                          </svg>
                        </button>
                        <button type="button" className="icon-btn" title="Imprimir etiqueta" aria-label={`Imprimir etiqueta de ${m.name}`}
                          onClick={() => setLabelTargets([m])}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
                            <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
                          </svg>
                        </button>
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
        <>
        <div className="toolbar" style={{ position: 'relative' }}>
          <input
            className="search-input"
            placeholder="Buscar nota fiscal, material, descrição ou responsável..."
            value={mvFilters.search}
            onChange={(e) => setMvFilter({ search: e.target.value })}
          />
          <button
            type="button"
            className={'btn btn-secondary' + (mvFilterActive ? ' filter-btn-active' : '')}
            onClick={() => setShowMvFilters((v) => !v)}
          >
            Filtros{mvFilterActive ? ' •' : ''}
          </button>

          {showMvFilters && (
            <div className="filter-balloon filter-balloon-wide">
              <div className="field-label">Período</div>
              <div className="chip-row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                {[['hoje', 'Hoje'], ['7dias', '7 dias'], ['mes', 'Este mês'], ['mespassado', 'Mês passado']].map(([k, label]) => {
                  const p = quickPeriod(k)
                  const active = mvFilters.from === p.from && mvFilters.to === p.to
                  return (
                    <button type="button" key={k} className={'chip chip-small' + (active ? ' active' : '')} onClick={() => setMvFilter(p)}>{label}</button>
                  )
                })}
              </div>
              <div className="field-grid" style={{ marginBottom: 12 }}>
                <div>
                  <label className="filter-sub-label">De</label>
                  <input className="input" type="date" value={mvFilters.from} onChange={(e) => setMvFilter({ from: e.target.value })} />
                </div>
                <div>
                  <label className="filter-sub-label">Até</label>
                  <input className="input" type="date" value={mvFilters.to} onChange={(e) => setMvFilter({ to: e.target.value })} />
                </div>
              </div>

              <div className="field-label">Tipo</div>
              <select className="input" style={{ marginBottom: 12 }} value={mvFilters.type} onChange={(e) => setMvFilter({ type: e.target.value })}>
                <option value="todos">Entradas e saídas</option>
                <option value="entrada">Só entradas</option>
                <option value="saida">Só saídas</option>
              </select>

              <div className="field-label">Local (destino)</div>
              <select className="input" style={{ marginBottom: 12 }} value={mvFilters.destination} onChange={(e) => setMvFilter({ destination: e.target.value })}>
                <option value="todos">Todos os locais</option>
                {ALL_LOCATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>

              <div className="field-label">Material</div>
              <select className="input" style={{ marginBottom: 16 }} value={mvFilters.materialId} onChange={(e) => setMvFilter({ materialId: e.target.value })}>
                <option value="todos">Todos os materiais</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.code ? `${m.code} · ` : ''}{m.name}</option>)}
              </select>

              <div className="modal-actions" style={{ marginTop: 0 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMvFilter(EMPTY_MV_FILTERS)}>Limpar filtros</button>
                <button type="button" className="btn btn-primary" onClick={() => setShowMvFilters(false)}>Aplicar</button>
              </div>
            </div>
          )}
        </div>
        <div className="empty-hint" style={{ padding: '0 2px 10px' }}>{mvSummary}{mvFilterLabel ? ` — ${mvFilterLabel}` : ''}</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="select-col">
                  <input
                    type="checkbox"
                    checked={filteredMovements.length > 0 && selectedMovements.size === filteredMovements.length}
                    onChange={() => toggleAllSet(setSelectedMovements, filteredMovements.map((m) => m.id))}
                  />
                </th>
                <th>Data</th><th>Material</th><th>Tipo</th><th>Destino</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th><th>Nota fiscal</th><th>Descrição</th><th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((mv) => (
                <tr key={mv.id}>
                  <td className="select-col">
                    <input type="checkbox" checked={selectedMovements.has(mv.id)} onChange={() => toggleSet(setSelectedMovements, mv.id)} />
                  </td>
                  <td>{formatDay(movementDay(mv))}</td>
                  <td>{mv.material?.name}</td>
                  <td style={{ color: mv.type === 'entrada' ? '#141414' : 'var(--red)', fontWeight: 700 }}>
                    {mv.type === 'entrada' ? 'Entrada' : 'Saída'}
                  </td>
                  <td>{movementPlace(mv) || '—'}</td>
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
              {filteredMovements.length === 0 && (
                <tr><td colSpan={11} className="empty-hint">{movements.length === 0 ? 'Nenhuma movimentação registrada.' : 'Nenhuma movimentação com esses filtros.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      <PrintReport
        title={
          tab === 'materiais'
            ? 'Relatório de Materiais'
            : `Relatório de Movimentação de Estoque${mvFilterLabel ? ` — ${mvFilterLabel}` : ''}`
        }
        columns={tab === 'materiais' ? materialColumns : movementColumns}
        rows={
          tab === 'materiais'
            ? (selectedMaterials.size > 0 ? sortedMaterials.filter((m) => selectedMaterials.has(m.id)) : sortedMaterials)
            : (selectedMovements.size > 0 ? filteredMovements.filter((m) => selectedMovements.has(m.id)) : filteredMovements)
        }
      />

      {materialTarget && (() => {
        // Janela do lápis: abas "Entrada / saída" e "Editar dados"
        const tabs = (
          <div className="segmented" style={{ width: '100%', marginBottom: 16 }}>
            <button type="button" className={'segmented-item' + (materialTarget.tab === 'movimentar' ? ' active' : '')} style={{ flex: 1 }}
              onClick={() => setMaterialTarget((t) => ({ ...t, tab: 'movimentar' }))}>Entrada / saída</button>
            <button type="button" className={'segmented-item' + (materialTarget.tab === 'editar' ? ' active' : '')} style={{ flex: 1 }}
              onClick={() => setMaterialTarget((t) => ({ ...t, tab: 'editar' }))}>Editar dados</button>
          </div>
        )
        const close = () => setMaterialTarget(null)
        const done = () => { setMaterialTarget(null); load() }
        return materialTarget.tab === 'editar' ? (
          <EditMaterialModal key="editar" material={materialTarget.material} tabs={tabs} onClose={close} onSaved={done} />
        ) : (
          <StockUpdateModal key="movimentar" material={materialTarget.material} tabs={tabs} userId={user?.id} onClose={close} onDone={done} />
        )
      })()}

      {showImport && (
        <InvoiceImportModal
          materials={materials}
          onClose={() => setShowImport(false)}
          onDone={(count, number) => {
            setShowImport(false)
            setNotice(`Nota fiscal nº ${number} importada: ${count} entrada(s) lançada(s) no estoque.`)
            setTab('movimentacao')
            load()
          }}
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

function StockUpdateModal({ material, tabs, userId, onClose, onDone }) {
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
        <div className="modal-title">{material.code ? `${material.code} · ` : ''}{material.name}</div>
        {tabs}
        <div className="modal-sub">{material.qty} {material.unit} em estoque</div>

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

function EditMaterialModal({ material, tabs, onClose, onSaved }) {
  const [name, setName] = useState(material.name || '')
  const [unit, setUnit] = useState(material.unit || 'un')
  const [minQty, setMinQty] = useState(material.min_qty ?? 0)
  const [unitPrice, setUnitPrice] = useState(material.unit_price ?? '')
  const [photoUrl, setPhotoUrl] = useState(material.photo_url || null)
  const [newPhoto, setNewPhoto] = useState(null)
  const [newPhotoPreview, setNewPhotoPreview] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const unitOptions = UNITS.some((u) => u.value === unit) ? UNITS : [...UNITS, { value: unit, label: unit }]

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCropSrc({ url: URL.createObjectURL(file), name: file.name })
  }

  function removePhoto() {
    setNewPhoto(null)
    setNewPhotoPreview(null)
    setPhotoUrl(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Informe o nome do material.')
    if (String(minQty).trim() === '' || !(Number(minQty) >= 0)) return setError('Informe um estoque mínimo válido (0 ou mais).')
    setSaving(true)
    try {
      let photo_url = photoUrl
      if (newPhoto) photo_url = await uploadFile(newPhoto, 'materials')
      await updateMaterial(material.id, {
        name: name.trim(),
        unit,
        min_qty: Number(minQty),
        unit_price: unitPrice !== '' ? Number(unitPrice) : 0,
        photo_url,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const shownPhoto = newPhotoPreview || photoUrl

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-sheet" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
        <div className="modal-title">{material.code ? `${material.code} · ` : ''}{material.name}</div>
        {tabs}
        <div className="modal-sub">
          {material.code || 'sem código'} · {material.qty} {material.unit} em estoque. A quantidade só muda pelo botão Atualizar (entrada ou saída).
        </div>

        <div className="edit-photo">
          {shownPhoto ? <img src={shownPhoto} alt="" /> : <div className="edit-photo-empty">Sem foto</div>}
          <div className="edit-photo-actions">
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              {shownPhoto ? 'Trocar foto' : 'Adicionar foto'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
            </label>
            {shownPhoto && (
              <button type="button" className="btn" style={{ background: 'var(--bg-tint)', color: 'var(--red)' }} onClick={removePhoto}>
                Remover foto
              </button>
            )}
          </div>
        </div>

        <label className="field-label">Nome</label>
        <input className="input" style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="field-grid">
          <div>
            <label className="field-label">Unidade</label>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {unitOptions.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Estoque mínimo</label>
            <input className="input" type="number" min="0" step="any" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Valor unitário</label>
            <input className="input" type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="R$ 0,00" />
          </div>
        </div>

        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc.url}
            fileName={cropSrc.name}
            aspect={1}
            onCancel={() => setCropSrc(null)}
            onConfirm={(file) => {
              setNewPhoto(file)
              setNewPhotoPreview(URL.createObjectURL(file))
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
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
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
