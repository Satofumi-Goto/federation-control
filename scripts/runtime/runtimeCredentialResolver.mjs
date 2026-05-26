#!/usr/bin/env node
/**
 * Runtime Credential Resolver
 *
 * Resolves local GitHub and Grafana credentials from environment
 * variables. Never prints, logs, or commits full tokens.
 */

const MASK_VISIBLE = 4;

function mask(token) {
  if (!token) return '(not set)';
  if (token.length <= MASK_VISIBLE * 2) return '***';
  return token.slice(0, MASK_VISIBLE) + '***' + token.slice(-MASK_VISIBLE);
}

/**
 * Resolve Grafana credentials.
 * Sources: GRAFANA_TOKEN, GRAFANA_URL env vars.
 */
export function resolveGrafana() {
  const token = process.env.GRAFANA_TOKEN ?? null;
  const url = process.env.GRAFANA_URL ?? null;

  return {
    available: !!(token && url),
    token,
    url,
    masked: {
      token: mask(token),
      url: url ?? '(not set)',
    },
  };
}

/**
 * Resolve GitHub credentials.
 * Sources: GITHUB_TOKEN, GH_TOKEN, or gh CLI auth.
 */
export function resolveGitHub() {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;

  return {
    available: !!token,
    token,
    masked: {
      token: mask(token),
    },
  };
}

/**
 * Resolve Cursor API credentials.
 * Sources: CURSOR_API_KEY env var.
 */
export function resolveCursorApiKey() {
  const key = process.env.CURSOR_API_KEY ?? null;

  return {
    available: !!key,
    key,
    masked: {
      key: mask(key),
    },
  };
}

/**
 * Get a safe-to-log credential summary. No full tokens exposed.
 */
export function getCredentialSummary() {
  const grafana = resolveGrafana();
  const github = resolveGitHub();
  const cursor = resolveCursorApiKey();

  return {
    grafana: {
      available: grafana.available,
      token: grafana.masked.token,
      url: grafana.masked.url,
    },
    github: {
      available: github.available,
      token: github.masked.token,
    },
    cursor: {
      available: cursor.available,
      key: cursor.masked.key,
    },
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('runtimeCredentialResolver.mjs')) {
  const summary = getCredentialSummary();
  console.log('[credentials] Credential summary (masked):');
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.grafana.available) {
    console.log('[credentials] WARN: GRAFANA_TOKEN or GRAFANA_URL not set');
  }
  if (!summary.github.available) {
    console.log('[credentials] WARN: GITHUB_TOKEN / GH_TOKEN not set');
  }
  if (!summary.cursor.available) {
    console.log('[credentials] WARN: CURSOR_API_KEY not set');
  }
}
