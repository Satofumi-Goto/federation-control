/** Theme tokens — inline styles only. Hard white cards are used so Grafana dark mode does not turn Runtime cards dark. */

export const cardBase =
  'background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-sizing:border-box;color:#111827';

export const cardLink =
  'display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:10px 12px;text-decoration:none;background:#fff;border:1px solid #e5e7eb;border-radius:10px;color:#111827;font-size:15px;font-weight:700;text-align:center';

export const navLink =
  'display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;padding:4px 6px;text-decoration:none;background:#fff;border:1px solid #e5e7eb;border-radius:8px;color:#111827;font-size:10px;font-weight:700;text-align:center;line-height:1.25';

/** Encode SVG for <img src="data:image/svg+xml,...">. */
export function svgDataUri(svg) {
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27');
  return `data:image/svg+xml,${encoded}`;
}

/** Grafana text panel options: HTML mode. */
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
