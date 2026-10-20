/** "2026-10-23" → "viernes 23 de octubre". La fecha del evento es local (sin hora ni zona). */
export function formatearFecha(fecha: string | null | undefined): string {
  const partes = fecha?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!partes) return ''
  const [, anio, mes, dia] = partes.map(Number) as [number, number, number, number]
  const d = new Date(anio, mes - 1, dia)
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(d)
    .replace(',', '')
}
