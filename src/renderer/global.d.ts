import type { AriadneApi } from '../compartido/ipc'

declare global {
  interface Window {
    ariadne: AriadneApi
  }
}
