export function CarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 16l1.2-4.8A2 2 0 0 1 7.1 9.7h9.8a2 2 0 0 1 1.9 1.5L20 16" />
      <rect x="2.5" y="16" width="19" height="3.2" rx="1.2" />
      <circle cx="7" cy="19.2" r="1.6" />
      <circle cx="17" cy="19.2" r="1.6" />
      <path d="M7 9.7V7.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2.2" />
    </svg>
  )
}

export function TractorIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 15h3V9h4l3 3h2.5A2.5 2.5 0 0 1 18 14.5V15" />
      <path d="M10 9V6h3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="18" r="4.2" />
      <path d="M3 15v1a2 2 0 0 0 2 2" />
    </svg>
  )
}

export function BrushCutterIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="6" height="7" rx="1.2" />
      <path d="M9 6.5h3.5" />
      <path d="M12.5 6.5L19 17" />
      <circle cx="19.5" cy="18.5" r="3" />
      <path d="M17.3 16.3l4.4 4.4" />
    </svg>
  )
}

export function WrenchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.1-2.1 2.4-2.2Z" />
    </svg>
  )
}

export function DrillIcon(props) {
  return (
    <svg viewBox="0 0 64 64" {...props}>
      <path d="M6 20h34a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-3v6a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3v-6H9a3 3 0 0 1-3-3V23a3 3 0 0 1 3-3Z" fill="#f5a623" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      <path d="M6 20h6a3 3 0 0 1 0 6H6" fill="#e8960f" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      <rect x="14" y="26" width="12" height="8" rx="1.5" fill="#4a4a4a" stroke="#111" strokeWidth="2.5" />
      <circle cx="31" cy="24.5" r="1.6" fill="#111" />
      <circle cx="31" cy="29" r="1.6" fill="#111" />
      <circle cx="31" cy="33.5" r="1.6" fill="#111" />
      <path d="M13 34v9a3 3 0 0 0 3 3h4a2 2 0 0 0 2-2 2 2 0 0 0-2-2h-1v-8Z" fill="#f5a623" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      <rect x="16" y="38" width="6" height="6" rx="1.5" fill="#d93b3b" stroke="#111" strokeWidth="2.5" />
      <rect x="40" y="21" width="6" height="10" rx="1" fill="#4a4a4a" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      <path d="M46 23l6 1.5v6L46 32Z" fill="#7a7a85" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      <path d="M52 26.5c2-1.5 3-1.5 4-3 1-1 2 0 3-1s2.5-1 3.5 0" fill="none" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

// Só Equipamentos usa um desenho (não existe emoji de furadeira no padrão Unicode).
// As outras categorias usam emoji de verdade.
export const CATEGORY_ICON_COMPONENTS = {
  equipamento: DrillIcon,
}

export const CATEGORY_EMOJI = {
  veiculo: '🚗',
  maquina: '🚜',
  ferramenta: '🔧',
}
