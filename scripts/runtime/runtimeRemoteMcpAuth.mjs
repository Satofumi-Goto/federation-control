#!/usr/bin/env node
/**
 * Runtime Remote MCP Auth Layer
 *
 * Validates bearer tokens for remote MCP HTTP requests.
 * Token is read from REMOTE_MCP_AUTH_TOKEN env var or .env.runtime.
 * Never logs, prints, or exposes the actual token value.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function resolveAuthToken() {
  // 1. Environment variable
  if (process.env.REMOTE_MCP_AUTH_TOKEN) {
    return process.env.REMOTE_MCP_AUTH_TOKEN;
  }

  // 2. .env.runtime file
  const envPath = path.resolve(REPO_ROOT, '.env.runtime');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^REMOTE_MCP_AUTH_TOKEN=(.+)$/m);
      if (match && match[1].trim().length > 0) {
        return match[1].trim();
      }
    } catch { /* ignore */ }
  }

  return null;
}

export function isAuthConfigured() {
  const token = resolveAuthToken();
  return token != null && token.length >= 16;
}

export function maskedToken() {
  const token = resolveAuthToken();
  if (!token) return '(not set)';
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****' + token.slice(-4);
}

/**
 * Validate an Authorization header value.
 * Returns { valid, reason }.
 */
export function validateAuth(authHeader) {
  if (!authHeader) {
    return { valid: false, reason: 'MISSING_AUTH', status: 401 };
  }

  const expectedToken = resolveAuthToken();
  if (!expectedToken || expectedToken.length < 16) {
    return { valid: false, reason: 'AUTH_NOT_CONFIGURED', status: 503 };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, reason: 'INVALID_AUTH_SCHEME', status: 401 };
  }

  const provided = authHeader.slice(7).trim();
  if (provided.length === 0) {
    return { valid: false, reason: 'EMPTY_TOKEN', status: 401 };
  }

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== expectedToken.length) {
    return { valid: false, reason: 'INVALID_TOKEN', status: 403 };
  }

  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return { valid: false, reason: 'INVALID_TOKEN', status: 403 };
  }

  return { valid: true, reason: 'AUTHENTICATED', status: 200 };
}

// ── CLI: self-check ──

if (process.argv[1]?.endsWith('runtimeRemoteMcpAuth.mjs')) {
  console.log('[remote-auth] Runtime Remote MCP Auth');
  console.log('='.repeat(50));
  console.log(`  Token configured: ${isAuthConfigured()}`);
  console.log(`  Token (masked): ${maskedToken()}`);

  const testMissing = validateAuth(null);
  console.log(`  Missing auth → ${testMissing.reason} (${testMissing.status})`);

  const testBadScheme = validateAuth('Basic abc123');
  console.log(`  Bad scheme → ${testBadScheme.reason} (${testBadScheme.status})`);

  const testEmpty = validateAuth('Bearer ');
  console.log(`  Empty token → ${testEmpty.reason} (${testEmpty.status})`);

  if (isAuthConfigured()) {
    const testWrong = validateAuth('Bearer wrong-token-value-here-xxxx');
    console.log(`  Wrong token → ${testWrong.reason} (${testWrong.status})`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`[remote-auth] ${isAuthConfigured() ? 'AUTH READY' : 'AUTH NOT CONFIGURED'}`);
  console.log('\n' + JSON.stringify({
    ok: isAuthConfigured(),
    configured: isAuthConfigured(),
    masked: maskedToken(),
    timestamp: new Date().toISOString(),
  }, null, 2));
}
