/**
 * csv — tiny CSV helpers for admin exports.
 *
 * Values are escaped per RFC 4180: fields containing a comma, double quote or
 * newline are wrapped in double quotes and inner quotes are doubled. The file
 * is produced with a UTF-8 BOM so Excel opens non-ASCII text (e.g. notes in
 * Filipino) correctly.
 */

/** Escape a single CSV cell. */
export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Build a CSV file from headers + rows and trigger a browser download. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ]
  // \uFEFF = UTF-8 BOM — Excel compatibility for non-ASCII text.
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Today's date as `YYYY-MM-DD` — used in export filenames. */
export function todayStamp(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
