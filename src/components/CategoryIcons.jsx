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

export const CATEGORY_ICON_COMPONENTS = {
  veiculo: CarIcon,
  maquina: TractorIcon,
  equipamento: BrushCutterIcon,
  ferramenta: WrenchIcon,
}
