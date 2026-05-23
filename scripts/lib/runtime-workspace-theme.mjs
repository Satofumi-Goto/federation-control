/** Theme tokens — inline styles only (Grafana text panel sanitizer strips <style> and <svg>). */

export const cardBase =
  'background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:12px;box-sizing:border-box;color:var(--text-primary,#111827)';

export const cardLink =
  'display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:10px 12px;text-decoration:none;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;color:var(--text-primary,#111827);font-size:15px;font-weight:700;text-align:center';

export const navLink =
  'display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;padding:4px 6px;text-decoration:none;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:8px;color:var(--text-primary,#111827);font-size:10px;font-weight:700;text-align:center;line-height:1.25';

/** Encode SVG for <img src="data:image/svg+xml,..."> (works under HTML sanitize). */
export function svgDataUri(svg) {
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27');
  return `data:image/svg+xml,${encoded}`;
}

/** Grafana text panel options: HTML mode (never markdown). */
export function textPanelOptions(content) {
  return {
    mode: 'html',
    content,
    code: {
      language: 'html',
      showLineNumbers: false,
      showMiniMap: false,
    },
  };
}

export function textPanel(panel) {
  return {
    ...panel,
    type: 'text',
    pluginVersion: '11.5.2',
    options: textPanelOptions(panel.options?.content ?? panel.options),
  };
}
