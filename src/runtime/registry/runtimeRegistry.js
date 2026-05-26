/**
 * Runtime Registry — canonical card definitions.
 * Cards are render-only; routing is resolved by runtimeRoutingResolver.
 * The ＋ window appends user-created entries via localStorage.
 *
 * Canonical data lives in runtimeRegistryData.json (consumed by both
 * this client module and the Grafana build script).
 */

import registryData from './runtimeRegistryData.json';

export const RUNTIME_REGISTRY_STORAGE_KEY = 'runtimeRegistryCards';

export const runtimeRegistry = registryData;

/** Merge canonical + user-created entries from localStorage. */
export function loadFullRegistry() {
  const userCards = loadUserRegistryCards();
  return [...runtimeRegistry, ...userCards];
}

export function loadUserRegistryCards() {
  try {
    return JSON.parse(localStorage.getItem(RUNTIME_REGISTRY_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveUserRegistryCard(card) {
  const cards = loadUserRegistryCards();
  cards.push({ ...card, id: card.id || `user-${Date.now()}`, source: 'user-created' });
  localStorage.setItem(RUNTIME_REGISTRY_STORAGE_KEY, JSON.stringify(cards));
  return cards;
}
