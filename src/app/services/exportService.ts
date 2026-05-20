type CsvCell = string | number | boolean | null | undefined

export type CsvRow = CsvCell[]

function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function buildCsv(headers: string[], rows: CsvRow[]): string {
  const lines = [headers.map(escapeCsvCell).join(',')]

  rows.forEach((row) => {
    lines.push(row.map(escapeCsvCell).join(','))
  })

  return lines.join('\r\n')
}

function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportCsv(filename: string, headers: string[], rows: CsvRow[]): void {
  const csv = buildCsv(headers, rows)
  downloadTextFile(filename, csv)
}

