/**
 * Lista de participantes pegada desde Excel (columnas separadas por tabulación) o leída de un CSV
 * (coma o punto y coma). Primera columna: nombre; segunda (opcional): lote, entrada o DNI.
 * Saltea filas vacías y una fila de títulos ("Nombre", "Apellido y nombre"…).
 */
export function leerParticipantes(texto: string): { nombre: string; dato: string }[] {
  const filas = (texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto).split(/\r?\n/)
  const sep = filas.some((f) => f.includes('\t')) ? '\t' : filas.some((f) => f.includes(';')) ? ';' : ','
  const lista = filas
    .map((f) => f.split(sep).map(limpiar))
    .filter((c) => c[0])
    .map((c) => ({ nombre: c[0]!.slice(0, 80), dato: (c[1] ?? '').slice(0, 40) }))
  if (lista.length > 0 && /^(nombre|apellido|participante)/i.test(lista[0]!.nombre)) lista.shift()
  return lista
}

const limpiar = (celda: string) => celda.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim()
