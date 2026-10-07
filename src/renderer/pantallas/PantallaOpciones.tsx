import { useEffect, useState } from 'react'
import type { CategoriaCatalogo, ListaDeOpciones, ResultadoCatalogo, VistaOpcion } from '../../compartido/ipc'

const AYUDA: Record<CategoriaCatalogo, string> = {
  estado_alumno: 'Cómo llegó o cómo estuvo el alumno durante la sesión.',
  respuesta_actividades: 'Cómo respondió a lo que se trabajó.'
}

/** Las palabras que ella pulsará al registrar una sesión. Son suyas: la aplicación no trae ninguna inventada. */
export function PantallaOpciones() {
  const [listas, setListas] = useState<ListaDeOpciones[] | null>(null)
  const [nuevas, setNuevas] = useState<Record<string, string>>({})
  const [editando, setEditando] = useState<{ id: number; texto: string } | null>(null)
  const [aviso, setAviso] = useState<{ donde: string; mensaje: string } | null>(null)
  const api = window.ariadne.catalogo

  useEffect(() => {
    api.listar().then(setListas)
  }, [])

  async function aplicar(donde: string, peticion: Promise<ResultadoCatalogo>, alTerminar?: () => void) {
    const resultado = await peticion
    if (resultado.tipo === 'invalido') return setAviso({ donde, mensaje: resultado.mensaje })
    setAviso(null)
    setListas(resultado.listas)
    alTerminar?.()
  }

  if (!listas) return null

  function fila(lista: ListaDeOpciones, opcion: VistaOpcion, i: number) {
    if (editando?.id === opcion.id) {
      return (
        <li key={opcion.id} className="opcion">
          <form
            className="fila-opcion"
            onSubmit={(e) => {
              e.preventDefault()
              aplicar(lista.categoria, api.renombrar(opcion.id, editando.texto), () => setEditando(null))
            }}
          >
            <input
              aria-label="Texto de la opción"
              value={editando.texto}
              onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
              autoFocus
            />
            <button type="submit" className="principal">Guardar</button>
            <button type="button" onClick={() => setEditando(null)}>Cancelar</button>
          </form>
        </li>
      )
    }
    return (
      <li key={opcion.id} className={opcion.activa ? 'opcion' : 'opcion desactivada'}>
        <span className="texto-opcion">
          {opcion.texto}
          {!opcion.activa && <span className="etiqueta etiqueta-apagada">desactivada</span>}
        </span>
        <span className="acciones-opcion">
          <button className="flecha" aria-label={`Subir «${opcion.texto}»`} disabled={i === 0}
            onClick={() => aplicar(lista.categoria, api.mover(opcion.id, 'arriba'))}>↑</button>
          <button className="flecha" aria-label={`Bajar «${opcion.texto}»`} disabled={i === lista.opciones.length - 1}
            onClick={() => aplicar(lista.categoria, api.mover(opcion.id, 'abajo'))}>↓</button>
          <button className="enlace" onClick={() => { setAviso(null); setEditando({ id: opcion.id, texto: opcion.texto }) }}>Corregir</button>
          <button className="enlace" onClick={() => aplicar(lista.categoria, api.activar(opcion.id, !opcion.activa))}>
            {opcion.activa ? 'Desactivar' : 'Reactivar'}
          </button>
        </span>
      </li>
    )
  }

  return (
    <main className="pantalla">
      <h1>Opciones del registro</h1>
      <p className="apunte">
        Son las palabras que pulsarás al registrar una sesión, para no tener que escribirlas cada vez. Escríbelas como las
        dices tú. Las que desactives dejan de ofrecerse, pero las sesiones ya registradas conservan lo que pusiste.
      </p>

      {listas.map((lista) => (
        <section key={lista.categoria} className="seccion">
          <h2>{lista.nombre}</h2>
          <p className="apunte">{AYUDA[lista.categoria]}</p>

          {lista.opciones.length === 0 ? (
            <p className="vacio">Todavía no hay ninguna. Añade las primeras con tus propias palabras.</p>
          ) : (
            <ul className="lista-opciones">{lista.opciones.map((o, i) => fila(lista, o, i))}</ul>
          )}

          <form
            className="fila-opcion nueva-opcion"
            onSubmit={(e) => {
              e.preventDefault()
              aplicar(lista.categoria, api.anadir(lista.categoria, nuevas[lista.categoria] ?? ''), () =>
                setNuevas({ ...nuevas, [lista.categoria]: '' })
              )
            }}
          >
            <input
              aria-label={`Nueva opción de ${lista.nombre.toLowerCase()}`}
              placeholder="Nueva opción"
              value={nuevas[lista.categoria] ?? ''}
              onChange={(e) => setNuevas({ ...nuevas, [lista.categoria]: e.target.value })}
            />
            <button type="submit">Añadir</button>
          </form>
          {aviso?.donde === lista.categoria && <p className="aviso">{aviso.mensaje}</p>}
        </section>
      ))}
    </main>
  )
}
