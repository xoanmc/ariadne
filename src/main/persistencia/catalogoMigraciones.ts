import { leerCatalogo } from './migraciones'

const ficheros = import.meta.glob<string>('../../../recursos/migraciones/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true
})

export const MIGRACIONES = leerCatalogo(ficheros)
