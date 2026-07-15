export default function PrintReport({ title, columns, rows }) {
  return (
    <div className="print-only">
      <div className="print-header">
        <img src="/logo.png" alt="logo" className="print-logo" />
        <div className="print-header-text">
          <div className="print-company">Granja Lucyara Dumont</div>
          <div className="print-report-title">{title}</div>
        </div>
        <div className="print-date">Gerado em {new Date().toLocaleString('pt-BR')}</div>
      </div>
      <table className="print-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row) : (row[col.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length}>Nenhum registro selecionado.</td></tr>
          )}
        </tbody>
      </table>
      <div className="print-footer">{rows.length} registro(s) · Granja Lucyara Dumont — Sistema de Inventário</div>
    </div>
  )
}
