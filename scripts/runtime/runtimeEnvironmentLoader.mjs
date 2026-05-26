#!/usr/bin/env node
/**
 * Runtime Environment Loader
 *
 * Loads .env.runtime into process.env without printing raw tokens.
 * Call loadRuntimeEnv() before any credential resolution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const ENV_PATH = path.resolve(REPO_ROOT, '.env.runtime');

/**
 * Parse a dotenv-style file into a key-value object.
 * Strips comments, blank lines, and optional quoting.
 */
function parseDotenv(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

/**
 * Load .env.runtime into process.env. Existing env vars take precedence.
 * Returns { loaded, varsSet, path }.
 */
export function loadRuntimeEnv() {
  let content;
  try {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    return { loaded: false, varsSet: 0, path: ENV_PATH, reason: 'file not found' };
  }

  const vars = parseDotenv(content);
  let varsSet = 0;

  for (const [key, val] of Object.entries(vars)) {
    if (!val) continue;
    if (!process.env[key]) {
      process.env[key] = val;
      varsSet++;
    }
  }

  return { loaded: true, varsSet, path: ENV_PATH };
}

/**
 * Get a safe runtime environment summary (no raw tokens).
 */
export function getRuntimeEnvSummary() {
  const mask = (v) => {
    if (!v) return '(not set)';
    if (v.length <= 8) return '***';
    return v.slice(0, 4) + '***' + v.slice(-4);
  };

  return {
    GRAFANA_URL: process.env.GRAFANA_URL ?? '(not set)',
    GRAFANA_TOKEN: mask(process.env.GRAFANA_TOKEN),
    GITHUB_TOKEN: mask(process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN),
  };
}

if (process.argv[1]?.endsWith('runtimeEnvironmentLoader.mjs')) {
  const result = loadRuntimeEnv();
  console.log('[env-loader] Load result:', JSON.stringify(result, null, 2));
  console.log('[env-loader] Environment (masked):', JSON.stringify(getRuntimeEnvSummary(), null, 2));
}
