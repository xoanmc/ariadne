import { useEffect, useState } from 'react'
import type { EstadoDatos } from '../compartido/ipc'
import { PantallaDatos } from './pantallas/PantallaDatos'
import { PantallaSinDatos } from './pantallas/PantallaSinDatos'

export function App() {
  const [estado, setEstado] = useState<EstadoDatos | null>(null)

  useEffect(() => {
    window.ariadne.datos.estado().then(setEstado)
  }, [])

  if (!estado) return null
  if (estado.tipo !== 'lista') return <PantallaSinDatos estado={estado} onEstado={setEstado} />
  return <PantallaDatos ruta={estado.ruta} avisoCopia={estado.avisoCopia} onEstado={setEstado} />
}
