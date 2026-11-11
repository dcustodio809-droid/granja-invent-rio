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
      </div>
    </div>
  )
}
