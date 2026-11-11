import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'

// Folha A4 de etiquetas adesivas: 3 colunas × 7 linhas, 63,5 × 38,1 mm (padrão Pimaco A4360 / 6180 A4)
export const LABELS_PER_SHEET = 21

function Barcode({ value }) {
  const ref = useRef(null)
  useEffect(() => {
    const svg = ref.current
    if (!svg || !value) return
    JsBarcode(svg, value, { format: 'CODE128', displayValue: false, margin: 0, height: 60, width: 2 })
    // escala o desenho para ocupar a largura da etiqueta
    const w = svg.getAttribute('width')
    const h = svg.getAttribute('height')
    svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`)
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.setAttribute('preserveAspectRatio', 'none')
  }, [value])
  return <svg ref={ref} className="label-barcode" />
}

export function Label({ material }) {
  return (
    <div className="label">
      <div className="label-head">
        <img src="/logo.png" alt="" className="label-logo" />
        <span>Granja Lucyara Dumont</span>
      </div>
      <div className="label-name">{material.name}</div>
      {material.code && <Barcode value={material.code} />}
      <div className="label-code">{material.code || 'SEM CÓDIGO'}</div>
    </div>
  )
}

// labels: lista de materiais (repetidos conforme a quantidade de cópias)
// startAt: posição (1 a 21) onde começar na primeira folha, para aproveitar folhas já usadas
export default function MaterialLabels({ labels, startAt = 1 }) {
  const slots = [...Array(Math.max(0, startAt - 1)).fill(null), ...labels]
  const sheets = []
  for (let i = 0; i < slots.length; i += LABELS_PER_SHEET) sheets.push(slots.slice(i, i + LABELS_PER_SHEET))

  return createPortal(
    <div className="labels-print">
      <style>{'@media print { @page { size: A4 portrait; margin: 0; } }'}</style>
      {sheets.map((sheet, si) => (
        <div className="label-sheet" key={si}>
          {sheet.map((m, i) => (m ? <Label key={i} material={m} /> : <div key={i} className="label label-empty" />))}
        </div>
      ))}
    </div>,
    document.body
  )
}
