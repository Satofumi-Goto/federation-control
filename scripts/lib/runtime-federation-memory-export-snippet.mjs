/** Base44 runtime federation memory + seneschal export (browser localStorage). */

export function runtimeFederationMemoryExportJs(consoleNamespace) {
  return `const MEMORY_KEY = 'runtimeFederationMemory';
const SENESCHAL_KEY = 'runtimeSeneschalEvents';
const CONSOLE_NS = ${JSON.stringify(consoleNamespace)};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export function collectConsoleRuntimeState() {
  const w = typeof window !== 'undefined' ? window : {};
  const signals = w.__RUNTIME_SIGNALS__ || w.runtimeSignals || {};
  return {
    Queue: signals.Queue ?? signals.queue ?? null,
    ETA: signals.ETA ?? signals.eta ?? null,
    ODD: signals.ODD ?? signals.odd ?? null,
    Constraint: signals.Constraint ?? signals.constraint ?? null,
    Dispatch: signals.Dispatch ?? signals.dispatch ?? null,
    Fleet: signals.Fleet ?? signals.fleet ?? null,
    Energy: signals.Energy ?? signals.energy ?? null,
    Node: signals.Node ?? signals.node ?? null,
    'Runtime status': signals.runtimeStatus ?? signals.status ?? 'UNKNOWN',
    'Collapse signal': signals.collapseSignal ?? signals.collapse ?? 'none',
    exportedAt: new Date().toISOString(),
  };
}

export function exportRuntimeFederationMemory() {
  const memory = readJson(MEMORY_KEY, {
    updatedAt: null,
    consoles: {},
    knowledgeExports: [],
    architectureDiff: [],
  });
  memory.updatedAt = new Date().toISOString();
  memory.consoles = memory.consoles || {};
  memory.consoles[CONSOLE_NS] = collectConsoleRuntimeState();
  writeJson(MEMORY_KEY, memory);
  return memory;
}

export function exportRuntimeSeneschalEvent(event) {
  const events = readJson(SENESCHAL_KEY, []);
  const entry = {
    ...event,
    console: CONSOLE_NS,
    at: new Date().toISOString(),
  };
  events.unshift(entry);
  writeJson(SENESCHAL_KEY, events.slice(0, 200));
  return entry;
}

export function startRuntimeFederationMemoryExport(intervalSeconds = 30) {
  exportRuntimeFederationMemory();
  if (typeof window === 'undefined') return () => {};
  const id = window.setInterval(() => exportRuntimeFederationMemory(), intervalSeconds * 1000);
  return () => window.clearInterval(id);
}

export const SENESCHAL_EVENT_TYPES = [
  'Queue delay',
  'ETA drift',
  'Dispatch failure',
  'ODD failure',
  'Node congestion',
  'Calendar relation',
];
`;
}
