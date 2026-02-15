import { createShimClient } from './shim'

export function createClient() {
  return createShimClient()
}

export async function getMetadata() {
  // No real session in the new auth system; return empty token
  return { accessToken: '' }
}
