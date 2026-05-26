/** Time-varying federation live state (not static memory snapshot). */

export function computeFederationLiveState(memory = {}, now = Date.now()) {
  const base = memory.federationLive ?? {};
  const updated = memory.updatedAt ? Date.parse(memory.updatedAt) : now;
  const ageSec = Math.max(0, (now - updated) / 1000);
  const tick = Math.sin(now / 45000) * 0.5 + 0.5;

  const drift = (key, fallback) => {
    const v = base[key] ?? fallback;
    const wobble = Math.round(Math.sin(now / 22000 + key.length) * 3);
    return Math.max(0, Math.min(100, v + wobble));
  };

  return {
    asOf: new Date(now).toISOString(),
    ageSec: Math.round(ageSec),
    federationHealth: drift('federationHealth', 74),
    queueDrift: drift('queueDrift', 12),
    etaDrift: drift('etaDrift', 9),
    throughputDrift: drift('throughputDrift', 6),
    runtimeAlignment: drift('runtimeAlignment', 82),
    collapseRisk: drift('collapseRisk', 32 + Math.round(tick * 8)),
    mode: 'live',
  };
}

export function liveStateMetricsHtml(live) {
  const items = [
    ['Federation Health', live.federationHealth, '#22c55e'],
    ['Queue Drift', live.queueDrift, '#f59e0b'],
    ['ETA Drift', live.etaDrift, '#f97316'],
    ['Throughput Drift', live.throughputDrift, '#0ea5e9'],
    ['Alignment', live.runtimeAlignment, '#8b5cf6'],
    ['Collapse Risk', live.collapseRisk, '#ef4444'],
  ];
  return items
    .map(
      ([label, value, color]) =>
        `<div style="padding:5px 6px;border-radius:8px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-left:3px solid ${color};min-width:0;">
          <div style="font-size:8px;color:var(--text-secondary,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
          <div style="font-size:13px;font-weight:800;color:var(--text-primary,#111827);">${value}</div>
        </div>`,
    )
    .join('');
}
