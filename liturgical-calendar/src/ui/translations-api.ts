/**
 * translations-api.ts — dev-only client for the translations sidecar.
 * Same-origin /api is proxied to the sidecar by Vite in dev.
 */

import type { Overrides } from './overrides';

const API_URL = '/api/translations';

/** Fetch all overrides. Fails soft to {} if the sidecar is unavailable. */
export async function getOverrides(): Promise<Overrides> {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return {};
    return (await res.json()) as Overrides;
  } catch {
    return {};
  }
}

/** Persist all overrides. Throws on failure so the editor can surface it. */
export async function saveOverrides(overrides: Overrides): Promise<void> {
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overrides),
  });
  if (!res.ok) {
    throw new Error(`Failed to save translations (HTTP ${res.status})`);
  }
}
