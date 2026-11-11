import { useState } from 'react'
import { findInvoiceImport, importInvoice, listSupplierProducts } from '../lib/data'
import { UNITS, mapUnit, parseNFe } from '../lib/nfe'

function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatQty(n) {
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

function normalize(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
}

// Janela "Importar nota fiscal": lê o XML da NF-e, deixa conferir e lança as entradas no estoque.
export default function InvoiceImportModal({ materials, onClose, onDone }) {
  const [mode, setMode] = useState('xml')
  const [invoice, setInvoice] = useState(null)
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [alreadyImported, setAlreadyImported] = useState(null)
  const [responsible, setResponsible] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setInvoice(null)
    setRows([])
    setAlreadyImported(null)
    setLoading(true)
    try {
      const nfe = parseNFe(await file.text())
      const [previous, links] = await Promise.all([
        findInvoiceImport(nfe.accessKey),
        listSupplierProducts(nfe.supplierCnpj),
      ])
      const linkByCode = Object.fromEntries(links.map((l) => [l.supplier_code, l.material_id]))
      const materialIds = new Set(materials.map((m) => m.id))
      const materialByName = Object.fromEntries(materials.map((m) => [normalize(m.name), m.id]))

      setRows(
        nfe.items.map((it) => {
          // 1º o que o sistema já aprendeu com este fornecedor; 2º material com o mesmo nome
          const linked = linkByCode[it.code]
          const sameName = materialByName[normalize(it.description)]
          const materialId = (linked && materialIds.has(linked) && linked) || sameName || ''
          return {
            ...it,
            action: materialId ? 'existing' : 'new',
            materialId,
            remembered: Boolean(linked && materialIds.has(linked)),
            newName: it.description,
            newUnit: mapUnit(it.unit),
            newMinQty: '',
            qtyInput: String(it.qty),
          }
        })
      )
      setInvoice(nfe)
      setFileName(file.name)
      setAlreadyImported(previous)
      setDescription(`NF ${nfe.number} - ${nfe.supplierName}`)
    } catch (err) {
      setError(err.message || 'Não foi possível ler o arquivo.')
    } finally {
      setLoading(false)
    }
  }

  function updateRow(index, patch) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const toLaunch = rows.filter((r) => r.action !== 'ignore')

  async function handleLaunch() {
    setError('')
    if (toLaunch.length === 0) {
      setError('Escolha pelo menos um produto para lançar.')
      return
    }
    for (const r of toLaunch) {
      if (!(Number(r.qtyInput) > 0)) return setError(`Quantidade inválida em: ${r.description}`)
      if (r.action === 'existing' && !r.materialId) return setError(`Escolha o material para: ${r.description}`)
      if (r.action === 'new' && !r.newName.trim()) return setError(`Informe o nome do material novo para: ${r.description}`)
      if (r.action === 'new' && (String(r.newMinQty).trim() === '' || !(Number(r.newMinQty) >= 0)))
        return setError(`Informe o estoque mínimo do material novo: ${r.newName || r.description}`)
    }
    setSaving(true)
    try {
      await importInvoice({
        access_key: invoice.accessKey,
        number: invoice.number,
        series: invoice.series,
        supplier_cnpj: invoice.supplierCnpj,
        supplier_name: invoice.supplierLegalName || invoice.supplierName,
        issue_date: invoice.issueDate,
        total_value: invoice.total,
        responsible,
        description,
        items: toLaunch.map((r) => ({
          supplier_code: r.code,
          supplier_description: r.description,
          action: r.action,
          material_id: r.action === 'existing' ? r.materialId : null,
          new_name: r.action === 'new' ? r.newName.trim() : null,
          new_unit: r.action === 'new' ? r.newUnit : null,
          new_min_qty: r.action === 'new' ? Number(r.newMinQty) : null,
          qty: Number(r.qtyInput),
          unit_price: r.unitPrice,
        })),
      })
      onDone(toLaunch.length, invoice.number)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Importar nota fiscal</div>

        <div className="segmented" style={{ width: '100%', marginBottom: 14 }}>
          <button type="button" className={'segmented-item' + (mode === 'xml' ? ' active' : '')} style={{ flex: 1 }} onClick={() => setMode('xml')}>
            Arquivo XML
          </button>
          <button type="button" className={'segmented-item' + (mode === 'manual' ? ' active' : '')} style={{ flex: 1 }} onClick={() => setMode('manual')}>
            Digitar manualmente
          </button>
        </div>

        {mode === 'manual' ? (
          <ManualInvoice materials={materials} onClose={onClose} onDone={onDone} />
        ) : (
        <>
        <div className="modal-sub">Escolha o arquivo XML da NF-e. O sistema lê os produtos e você confere antes de lançar.</div>

        <label className={'dropzone' + (invoice ? ' attached' : '')}>
          {loading ? 'Lendo a nota...' : invoice ? `Arquivo: ${fileName} (clique para trocar)` : 'ESCOLHER ARQUIVO XML DA NOTA'}
          <input type="file" accept=".xml,text/xml,application/xml" style={{ display: 'none' }} onChange={handleFile} />
        </label>

        {invoice && (
          <>
            <div className="nfe-summary">
              <div><span>Fornecedor</span><strong>{invoice.supplierName}</strong></div>
              <div><span>Nota fiscal</span><strong>Nº {invoice.number}{invoice.series ? ` · série ${invoice.series}` : ''}</strong></div>
              <div><span>Data da compra</span><strong>{invoice.issueDate ? new Date(invoice.issueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</strong></div>
              <div><span>Total da nota</span><strong>{formatBRL(invoice.total)}</strong></div>
            </div>

            {alreadyImported && (
              <div className="login-error">
                Esta nota já foi importada em {new Date(alreadyImported.created_at).toLocaleString('pt-BR')}. Não é possível lançar de novo.
              </div>
            )}
            {!invoice.authorized && (
              <div className="login-error">Atenção: esta nota não aparece como autorizada pela SEFAZ no arquivo.</div>
            )}

            <div className="nfe-rows">
              {rows.map((r, i) => (
                <div className={'nfe-row' + (r.action === 'ignore' ? ' ignored' : '')} key={r.itemNumber || i}>
                  <div className="nfe-prod">
                    <div className="nfe-prod-name">{r.description}</div>
                    <div className="nfe-prod-sub">
                      Cód. {r.code} · {formatQty(r.qty)} {r.unit} × {formatBRL(r.unitPrice)} = {formatBRL(r.total)}
                    </div>
                    {r.remembered && r.action === 'existing' && <div className="nfe-remembered">Ligação lembrada da última nota</div>}
                  </div>
                  <div className="nfe-action">
                    <select className="input" value={r.action} onChange={(e) => updateRow(i, { action: e.target.value })}>
                      <option value="existing">Lançar em material existente</option>
                      <option value="new">Criar material novo</option>
                      <option value="ignore">Ignorar</option>
                    </select>

                    {r.action === 'existing' && (
                      <select className="input" value={r.materialId} onChange={(e) => updateRow(i, { materialId: e.target.value })}>
                        <option value="">Escolha o material...</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>{m.code ? `${m.code} · ` : ''}{m.name} ({m.unit})</option>
                        ))}
                      </select>
                    )}

                    {r.action === 'new' && (
                      <div className="nfe-new">
                        <input className="input" value={r.newName} onChange={(e) => updateRow(i, { newName: e.target.value })} aria-label="Nome do material novo" />
                        <select className="input" value={r.newUnit} onChange={(e) => updateRow(i, { newUnit: e.target.value })} aria-label="Unidade">
                          {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </div>
                    )}

                    {r.action === 'new' && (
                      <div className="nfe-qty">
                        <label>Estoque mínimo *</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="any"
                          value={r.newMinQty}
                          onChange={(e) => updateRow(i, { newMinQty: e.target.value })}
                          placeholder={`em ${UNITS.find((u) => u.value === r.newUnit)?.label || r.newUnit}`}
                        />
                      </div>
                    )}

                    {r.action !== 'ignore' && (
                      <div className="nfe-qty">
                        <label>Quantidade a lançar</label>
                        <input className="input" type="number" min="0" step="any" value={r.qtyInput} onChange={(e) => updateRow(i, { qtyInput: e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="field-grid" style={{ marginTop: 14 }}>
              <div>
                <label className="field-label">Responsável</label>
                <input className="input" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Seu nome" />
              </div>
              <div>
                <label className="field-label">Descrição</label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {error && <div className="login-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          {invoice && (
            <button className="btn btn-primary" onClick={handleLaunch} disabled={saving || Boolean(alreadyImported) || toLaunch.length === 0}>
              {saving ? 'Lançando...' : `Lançar ${toLaunch.length} entrada(s)`}
            </button>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}

// Chave usada para impedir lançar a mesma nota duas vezes quando não há XML:
// fornecedor (CNPJ, ou nome se não tiver CNPJ) + número + série
export function manualInvoiceKey({ supplierCnpj, supplierName, number, series }) {
  const who = String(supplierCnpj || '').replace(/\D/g, '') || normalize(supplierName).replace(/[^A-Z0-9]/g, '')
  return `MANUAL-${who}-${String(number).trim().replace(/^0+/, '') || '0'}-${String(series || '').trim() || '0'}`
}

const NEW_MATERIAL = '__novo__'

function emptyLine() {
  return { materialId: '', newName: '', newUnit: 'un', newMinQty: '', qty: '', unitPrice: '' }
}

// Nota fiscal digitada à mão (quando não há o XML)
function ManualInvoice({ materials, onClose, onDone }) {
  const [supplierName, setSupplierName] = useState('')
  const [supplierCnpj, setSupplierCnpj] = useState('')
  const [number, setNumber] = useState('')
  const [series, setSeries] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const [lines, setLines] = useState([emptyLine()])
  const [responsible, setResponsible] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0)

  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  async function handleLaunch() {
    setError('')
    if (!supplierName.trim()) return setError('Informe o fornecedor.')
    if (!number.trim()) return setError('Informe o número da nota.')
    if (!issueDate) return setError('Informe a data da compra.')
    for (const [i, l] of lines.entries()) {
      const n = i + 1
      if (!l.materialId) return setError(`Produto ${n}: escolha o material ou "Criar material novo".`)
      if (l.materialId === NEW_MATERIAL) {
        if (!l.newName.trim()) return setError(`Produto ${n}: informe o nome do material novo.`)
        if (String(l.newMinQty).trim() === '' || !(Number(l.newMinQty) >= 0)) return setError(`Produto ${n}: informe o estoque mínimo do material novo.`)
      }
      if (!(Number(l.qty) > 0)) return setError(`Produto ${n}: informe a quantidade.`)
      if (String(l.unitPrice).trim() === '' || !(Number(l.unitPrice) >= 0)) return setError(`Produto ${n}: informe o valor unitário.`)
    }

    const accessKey = manualInvoiceKey({ supplierCnpj, supplierName, number, series })
    setSaving(true)
    try {
      if (await findInvoiceImport(accessKey)) throw new Error(`A nota nº ${number.trim()} deste fornecedor já foi lançada antes.`)
      await importInvoice({
        access_key: accessKey,
        number: number.trim(),
        series: series.trim(),
        supplier_cnpj: supplierCnpj.replace(/\D/g, ''),
        supplier_name: supplierName.trim(),
        issue_date: issueDate,
        total_value: Number(total.toFixed(2)),
        responsible,
        description: description.trim() || `NF ${number.trim()} - ${supplierName.trim()}`,
        items: lines.map((l) => ({
          supplier_code: '',
          supplier_description: l.materialId === NEW_MATERIAL ? l.newName.trim() : materials.find((m) => m.id === l.materialId)?.name,
          action: l.materialId === NEW_MATERIAL ? 'new' : 'existing',
          material_id: l.materialId === NEW_MATERIAL ? null : l.materialId,
          new_name: l.materialId === NEW_MATERIAL ? l.newName.trim() : null,
          new_unit: l.materialId === NEW_MATERIAL ? l.newUnit : null,
          new_min_qty: l.materialId === NEW_MATERIAL ? Number(l.newMinQty) : null,
          qty: Number(l.qty),
          unit_price: Number(l.unitPrice),
        })),
      })
      onDone(lines.length, number.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="modal-sub">Para quando não tiver o XML: digite os dados da nota em papel. Tudo entra como entrada no Almoxarifado.</div>

      <div className="manual-head">
        <div style={{ gridColumn: 'span 2' }}>
          <label className="field-label">Fornecedor *</label>
          <input className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Ferragista Guarani" />
        </div>
        <div>
          <label className="field-label">CNPJ</label>
          <input className="input" value={supplierCnpj} onChange={(e) => setSupplierCnpj(e.target.value)} placeholder="opcional" />
        </div>
        <div>
          <label className="field-label">Nº da nota *</label>
          <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Série</label>
          <input className="input" value={series} onChange={(e) => setSeries(e.target.value)} placeholder="opcional" />
        </div>
        <div>
          <label className="field-label">Data da compra *</label>
          <input className="input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
      </div>

      <div className="manual-lines">
        <div className="manual-line manual-line-head">
          <span>Material</span><span>Quantidade</span><span>Valor unitário</span><span />
        </div>
        {lines.map((l, i) => {
          const mat = materials.find((m) => m.id === l.materialId)
          return (
            <div key={i} className="manual-line-block">
              <div className="manual-line">
                <select className="input" value={l.materialId} onChange={(e) => updateLine(i, { materialId: e.target.value })} aria-label={`Material do produto ${i + 1}`}>
                  <option value="">Escolha o material...</option>
                  <option value={NEW_MATERIAL}>+ Criar material novo</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.code ? `${m.code} · ` : ''}{m.name} ({m.unit})</option>
                  ))}
                </select>
                <input className="input" type="number" min="0" step="any" value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })}
                  placeholder={mat ? mat.unit : l.materialId === NEW_MATERIAL ? (UNITS.find((u) => u.value === l.newUnit)?.label || '') : ''} aria-label={`Quantidade do produto ${i + 1}`} />
                <input className="input" type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} placeholder="R$ 0,00" aria-label={`Valor unitário do produto ${i + 1}`} />
                <button type="button" className="manual-remove" title="Remover produto" aria-label={`Remover produto ${i + 1}`}
                  onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [emptyLine()]))}>×</button>
              </div>
              {l.materialId === NEW_MATERIAL && (
                <div className="manual-new">
                  <input className="input" value={l.newName} onChange={(e) => updateLine(i, { newName: e.target.value })} placeholder="Nome do material novo" aria-label="Nome do material novo" />
                  <select className="input" value={l.newUnit} onChange={(e) => updateLine(i, { newUnit: e.target.value })} aria-label="Unidade">
                    {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                  <input className="input" type="number" min="0" step="any" value={l.newMinQty} onChange={(e) => updateLine(i, { newMinQty: e.target.value })} placeholder="Estoque mínimo *" aria-label="Estoque mínimo" />
                </div>
              )}
            </div>
          )
        })}
        <button type="button" className="manual-add" onClick={() => setLines((prev) => [...prev, emptyLine()])}>+ Adicionar produto</button>
        <div className="manual-total">Total digitado: <strong>{formatBRL(total)}</strong></div>
      </div>

      <div className="field-grid" style={{ marginTop: 14 }}>
        <div>
          <label className="field-label">Responsável</label>
          <input className="input" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Seu nome" />
        </div>
        <div>
          <label className="field-label">Descrição</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={number ? `NF ${number} - ${supplierName}` : 'NF ...'} />
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleLaunch} disabled={saving}>
          {saving ? 'Lançando...' : `Lançar ${lines.length} entrada(s)`}
        </button>
      </div>
    </>
  )
}
