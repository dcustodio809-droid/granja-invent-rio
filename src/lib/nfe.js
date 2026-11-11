// Leitura do XML da NF-e (modelo 55, versão 4.00) — tudo no navegador, sem serviço externo.

// Unidades do estoque (valor gravado + nome mostrado)
export const UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'un', label: 'un' },
  { value: 'L', label: 'litros (L)' },
  { value: 'lata', label: 'latas' },
  { value: 'sc', label: 'saco' },
  { value: 'cx', label: 'caixas' },
  { value: 'm2', label: 'm²' },
  { value: 'm', label: 'metros' },
]

// Converte a unidade da nota (UN, KG, M2...) para a unidade do estoque
const UNIT_MAP = {
  UN: 'un', UND: 'un', UNID: 'un', UNIDADE: 'un', PC: 'un', 'PÇ': 'un', PCS: 'un', PECA: 'un', 'PEÇA': 'un', JG: 'un', PAR: 'un', KIT: 'un',
  KG: 'kg', KGS: 'kg', QUILO: 'kg',
  L: 'L', LT: 'L', LTS: 'L', LITRO: 'L', LITROS: 'L',
  LATA: 'lata', LATAS: 'lata', LA: 'lata',
  SC: 'sc', SACO: 'sc', SACA: 'sc',
  CX: 'cx', CAIXA: 'cx',
  M2: 'm2', 'M²': 'm2',
  M: 'm', MT: 'm', MTS: 'm', METRO: 'm', METROS: 'm',
}

export function mapUnit(uCom) {
  const key = String(uCom || '').trim().toUpperCase()
  return UNIT_MAP[key] || 'un'
}

function text(parent, tag) {
  const el = parent?.getElementsByTagName(tag)[0]
  return el ? el.textContent.trim() : ''
}

// Lê o conteúdo de um arquivo XML de NF-e e devolve os dados da nota.
// Lança Error com mensagem em português se o arquivo não for uma NF-e válida.
export function parseNFe(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('O arquivo não é um XML válido.')
  }
  const inf = doc.getElementsByTagName('infNFe')[0]
  if (!inf) throw new Error('Este XML não é de uma nota fiscal eletrônica (NF-e).')

  const ide = inf.getElementsByTagName('ide')[0]
  const emit = inf.getElementsByTagName('emit')[0]
  const total = inf.getElementsByTagName('ICMSTot')[0]

  const accessKey =
    text(doc, 'chNFe') || (inf.getAttribute('Id') || '').replace(/^NFe/, '')
  const issue = text(ide, 'dhEmi') || text(ide, 'dEmi')

  const items = [...inf.getElementsByTagName('det')].map((det) => {
    const prod = det.getElementsByTagName('prod')[0]
    return {
      itemNumber: det.getAttribute('nItem'),
      code: text(prod, 'cProd'),
      ean: text(prod, 'cEAN'),
      description: text(prod, 'xProd'),
      unit: text(prod, 'uCom'),
      qty: Number(text(prod, 'qCom')) || 0,
      unitPrice: Number(text(prod, 'vUnCom')) || 0,
      total: Number(text(prod, 'vProd')) || 0,
    }
  })

  if (items.length === 0) throw new Error('A nota não tem produtos.')

  return {
    accessKey,
    number: text(ide, 'nNF'),
    series: text(ide, 'serie'),
    issueDate: issue ? issue.slice(0, 10) : '',
    supplierCnpj: text(emit, 'CNPJ') || text(emit, 'CPF'),
    supplierName: text(emit, 'xFant') || text(emit, 'xNome'),
    supplierLegalName: text(emit, 'xNome'),
    total: Number(text(total, 'vNF')) || items.reduce((s, i) => s + i.total, 0),
    authorized: !text(doc, 'cStat') || text(doc, 'cStat') === '100',
    items,
  }
}
