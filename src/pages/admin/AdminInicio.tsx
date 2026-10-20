/** Inicio del panel. Por ahora solo confirma el ingreso; la lista de noches llega en el paso 10. */
export default function AdminInicio({ nombre }: { nombre: string }) {
  const primerNombre = nombre.split(/[\s@]/)[0]

  return (
    <div className="rounded-carta bg-white p-8 shadow-md">
      <h1 className="text-3xl font-bold">¡Hola, {primerNombre}!</h1>
      <p className="mt-2 text-profundo/70">Entraste como conductor. Acá vas a ver y preparar las noches.</p>
    </div>
  )
}
